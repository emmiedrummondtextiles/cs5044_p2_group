// js/map.js ----------------------------------------------------------
import { showTooltip, hideTooltip } from './utils.js';

export function drawMap(rows, votingData, world, countryInfo) {
  const MAP_H = 550;

  // clear & recreate svg container
  const container = d3.select('#map');
  container.selectAll('*').remove();

  const svg = container.append('svg')
      .attr('width', '100%')
      .attr('height', MAP_H);

  const layer = svg.append('g').attr('class', 'layer');

  // compute current pixel width
  const svgW = container.node().getBoundingClientRect().width;

  // prepare map features
  let features = topojson
    .feature(world, world.objects.countries)
    .features;

  // rename Czech Republic → Czechia
  features.forEach(f => {
    if (f.properties.name === 'Czech Republic') {
      f.properties.name = 'Czechia';
    }
  });

  // Build a set of participant countries from your data rows
  const participantCountries = new Set(rows.map(r => r.Country));

  // Filter features to only keep participant countries
  features = features.filter(f => participantCountries.has(f.properties.name));

  // Define a bounding box with [minLon, minLat] and [maxLon, maxLat]
  // Boundaries: West: near Iceland, North: near Norway, East: near Russia, South: near Israel
  const bbox = [[-25, 29], [60, 71]];  
  // Further filter the features so that only those whose centroid lies within the bbox are kept;
  // Always include Russia even if its centroid is outside.
  features = features.filter(f => {
    if(f.properties.name === "Russia") return true;
    const cent = d3.geoCentroid(f);
    return cent[0] >= bbox[0][0] && cent[0] <= bbox[1][0] &&
           cent[1] >= bbox[0][1] && cent[1] <= bbox[1][1];
  });

  // Optionally, trim far‑east Russia and strip French Guiana from France as before:
  features = features
    .map(trimRussia)
    .filter(Boolean);

  features = features.map(f => {
    if (f.properties.name !== 'France' || f.geometry.type !== 'MultiPolygon') {
      return f;
    }
    const kept = f.geometry.coordinates.filter(poly => {
      const lat = d3.geoCentroid({ type: 'Polygon', coordinates: poly })[1];
      return lat > 25;
    });
    return {
      ...f,
      geometry: { ...f.geometry, coordinates: kept }
    };
  });

  // Build projection fitted to our *filtered* features:
  const projection = d3.geoNaturalEarth1()
    .fitSize([svgW, MAP_H], {
      type: 'FeatureCollection',
      features
    });
  const path = d3.geoPath().projection(projection);

  // defs for vote‑flow arrowheads
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -3 6 6')
    .attr('refX', 6)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
      .attr('d', 'M0,-3L6,0L0,3')
      .attr('fill', 'tomato');

  // Global state for selected year.
  // When currentYear === "all", we show all years.
  let currentYear = "all";

  // Set up event listeners for the slider and All Years button:
  d3.select('#yearSlider').on('input', function() {
    currentYear = this.value; // a year between 1998 and 2012 (as string)
    d3.select('#yearLabel').text(currentYear);
    colourMap();
    // Remove any visible voting arrows when changing the filter
    layer.selectAll('g.flow').remove();
  });

  d3.select('#allYearsBtn').on('click', function() {
    currentYear = "all";
    d3.select('#yearLabel').text("All Years");
    colourMap();
    // Remove flows when switching to All Years view
    layer.selectAll('g.flow').remove();
  });

  // Additionally, remove voting arrows when clicking away from a country
  svg.on('click', function(e) {
    // if the clicked element is NOT a country, remove the flows
    if (!d3.select(e.target).classed('country')) {
      layer.selectAll('g.flow').remove();
    }
  });

  // draw countries
  layer.selectAll('path.country')
    .data(features)
    .join('path')
      .attr('class', 'country')
      .attr('d', path)
      .attr('fill', '#ddd')
      .attr('stroke', '#fff')
      .on('mouseover', (e, d) => {
        const selectedYear = currentYear === "all" ? 0 : +currentYear;
        let content = '';
        if (selectedYear === 0) {
          // All Years view: show countryInfo data
          const stats = countryInfo.get(d.properties.name);
          content = stats
            ? `<strong>${d.properties.name}</strong><br>
               Wins: ${stats.wins}<br>
               Top‑5: ${stats.top5}<br>
               Avg rank: ${stats.avgRank.toFixed(1)}`
            : `<strong>${d.properties.name}</strong><br>No data`;
        } else {
          // Specific year view: show that year’s data from rows
          const entry = rows.find(r => r.Country === d.properties.name && +r.Year === selectedYear);
          content = entry
            ? `<strong>${d.properties.name}</strong><br>
               Points: ${entry.Normalized_Points}<br>
               Place: ${entry.Place}<br>
               Artist: ${entry.Artist}<br>
               Song: ${entry.Song}`
            : `<strong>${d.properties.name}</strong><br>No data for year ${selectedYear}`;
        }
        showTooltip(content, [e.pageX + 12, e.pageY + 12]);
      })
      .on('mouseout', hideTooltip)
      .on('click', (e, d) => showFlows(d.properties.name));

  // initial colour fill (all years)
  colourMap();

  // centre & crop to features
  zoomToLayer();

  // on window‑resize, recompute centre/scale
  window.addEventListener('resize', () => {
    zoomToLayer();
  });

  // expose a simple API to recolour by year
  return { colourMap };

  // ——— helpers ——————————————————

  function colourMap() {
    // Use the currentYear if no specific year is provided
    const selectedYear = currentYear === "all" ? 0 : +currentYear;
    const data = selectedYear ? rows.filter(r => +r.Year === selectedYear) : rows;
    const sums = d3.rollup(
      data,
      v => d3.sum(v, d => d.Normalized_Points),
      d => d.Country
    );
    const c = d3.scaleSequential([0, d3.max(sums.values())], d3.interpolatePlasma);
    layer.selectAll('path.country')
      .transition().duration(500)
      .attr('fill', d =>
        sums.has(d.properties.name)
          ? c(sums.get(d.properties.name))
          : '#eee'
      );
  }

  function showFlows(giver) {
    const selectedYear = currentYear === "all" ? 0 : +currentYear;
    const votes = votingData.filter(v =>
      v.Giver === giver &&
      (selectedYear === 0 || +v.Year === selectedYear) &&
      +v.Score !== 0
    );

    // Include extra info (giver, receiver, score) in each link object
    const links = votes.map(v => {
      const src = features.find(f => f.properties.name === v.Giver);
      const tgt = features.find(f => f.properties.name === v.Country);
      if (!src || !tgt) return null;
      return {
        value: +v.Score,
        g: v.Giver,
        r: v.Country,
        coords: {
          s: projection(d3.geoCentroid(src)),
          t: projection(d3.geoCentroid(tgt))
        }
      };
    }).filter(Boolean);

    const gFlow = layer.selectAll('g.flow').data([null]).join('g')
      .attr('class', 'flow');

    const w = d3.scaleLinear()
      .domain(d3.extent(links, d => d.value))
      .range([0.8, 4]);

    const sel = gFlow.selectAll('path').data(links);
    sel.join(
      enter => enter.append('path')
        .attr('fill', 'none')
        .attr('stroke', 'tomato')
        .attr('marker-end', 'url(#arrowhead)')
        .attr('stroke-opacity', 0.7)
        // Override CSS to allow pointer events on the arrows:
        .style('pointer-events', 'all')
        .on('mouseover', (e, d) => {
            showTooltip(
              `<strong>Giver:</strong> ${d.g}<br>
               <strong>Receiver:</strong> ${d.r}<br>
               <strong>Points:</strong> ${d.value}`,
              [e.pageX + 10, e.pageY + 10]
            );
        })
        .on('mouseout', hideTooltip),
      update => update,
      exit => exit.remove()
    )
    .attr('stroke-width', d => w(d.value))
    .attr('d', d => {
      const [x1, y1] = d.coords.s;
      const [x2, y2] = d.coords.t;
      const dr = 0.8 * Math.hypot(x2 - x1, y2 - y1);
      return `M${x1},${y1}A${dr},${dr} 0 0,1 ${x2},${y2}`;
    });
  }

  function zoomToLayer() {
    const box = layer.node().getBBox();
    const pad = 0.96;
    const scale = pad * Math.min(
      svg.node().clientWidth / box.width,
      MAP_H / box.height
    );
    const tx = (svg.node().clientWidth  - box.width * scale)  / 2 - box.x * scale;
    const ty = (MAP_H - box.height * scale) / 2 - box.y * scale;
    layer.attr('transform', `translate(${tx},${ty}) scale(${scale})`);
  }
}

// ——— trim far‑east Russia —————————————————————————
function trimRussia(feature) {
  if (feature.properties.name !== 'Russia') return feature;

  const polys = feature.geometry.type === 'MultiPolygon'
    ? feature.geometry.coordinates
    : [feature.geometry.coordinates];

  const west = polys.filter(poly =>
    poly[0].some(([lon]) => lon < 60)
  );

  if (!west.length) return null;
  return {
    ...feature,
    geometry: { type: 'MultiPolygon', coordinates: west }
  };
}