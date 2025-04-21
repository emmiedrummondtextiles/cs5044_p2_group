// ====== CONSTANTS & GLOBALS ====================================================
const FEATURES = [
  'energy', 'duration', 'acousticness', 'danceability', 'tempo', 'speechiness',
  'liveness', 'loudness', 'valence', 'Happiness'
];

const tooltip   = d3.select('#tooltip');
const mapSvg    = d3.select('#map').append('svg').attr('width','100%').attr('height','100%');
const dotSvg    = d3.select('#dotplotSVG');
const lineSvg   = d3.select('#linechartSVG');
const radarDiv  = d3.select('#radarContainer');
const treeSvg   = d3.select('#treemapSVG');
const corrSvg   = d3.select('#corrMatrixSVG');
const violinDiv = d3.select('#violinContainer');

// Helper: Clean a raw row by replacing "NA" with empty string and then autoType it
function customRow(d) {
  // For every key, if the value is "NA", replace it with an empty string.
  // d3.autoType will then convert empty strings to null.
  Object.keys(d).forEach(key => {
    if (d[key] === "NA") d[key] = "";
  });
  return d3.autoType(d);
}

// Populate feature dropdown
d3.select('#featureSelect').selectAll('option')
  .data(FEATURES)
  .enter().append('option')
    .attr('value', d => d)
    .text(d => d.charAt(0).toUpperCase() + d.slice(1));

// ====== DATA LOADING ==========================================================
Promise.all([
  d3.csv('data/eurovision_1998_to_2012.csv', customRow),
  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'),
  d3.csv('data/eurovision_1998_to_2012_voting.csv', customRow)
]).then(([rows, world, votingData]) => init(rows, world, votingData));

function init(rows, world, votingData) {
  console.log('CSV rows:', rows.length);
  console.log('Data loaded:', rows[0]);
  console.log('Voting data rows:', votingData.length);
  window.__rows = rows; // debug
  window.__votingData = votingData; // debug

  // ── 1. Prepare year extent & slider  ──
  const years = Array.from(new Set(rows.map(r => r.Year))).sort((a, b) => a - b);

  const slider = d3.select('#yearSlider')
    .attr('min', d3.min(years))
    .attr('max', d3.max(years))
    .on('input', (e) => {
      d3.select('#yearLabel').text(e.target.value);
      updateMap(+e.target.value);
    });
  d3.select('#resetYear').on('click', () => {
    slider.property('value', slider.attr('min'));
    d3.select('#yearLabel').text('All');
    updateMap();
  });

  // ── 2. Choropleth  ──
  const geo = topojson.feature(world, world.objects.countries).features;
  const projection = d3.geoNaturalEarth1();
  const pathGen = d3.geoPath().projection(projection);
  projection.fitSize([mapSvg.node().getBoundingClientRect().width, 550],
    { type: 'FeatureCollection', features: geo });

  mapSvg.selectAll('path.country')
    .data(geo)
    .enter().append('path')
      .attr('class', 'country')
      .attr('d', pathGen)
      .attr('fill', '#ddd')
      .attr('stroke', '#fff')
      .on('mouseover', handleCountryHover)
      .on('mouseout', () => tooltip.style('opacity', 0))
      .on('click', handleCountryClick);

  updateMap(); // initial draw (all years)

  // ── 3. Other views  ──
  drawDotPlot(rows);
  drawLineChart(rows);
  drawTreemap(rows);
  drawCorrelationMatrix(rows);
}

// ==================   MAP  =====================
function updateMap(year) {
  const dataset = year ? __rows.filter(r => r.Year === year) : __rows;
  const sumPerCountry = d3.rollup(dataset, v => d3.sum(v, d => d.Normalized_Points), d => d.Country);
  const maxSum = d3.max(sumPerCountry.values());
  const color = d3.scaleSequential([0, maxSum], d3.interpolatePlasma);

  mapSvg.selectAll('path.country')
    .transition().duration(500)
    .attr('fill', d => {
      const name = d.properties.name;
      return sumPerCountry.has(name) ? color(sumPerCountry.get(name)) : '#eee';
    });

  mapSvg.selectAll('path.country')
    .on('click', (event, d) => {
      const name = d.properties.name;
      const votesGiven = __votingData.filter(v => v.Giving_Country === name && (!year || v.Year === year));
      console.log(`Votes given by ${name}:`, votesGiven);
      // Add logic to display voting data (e.g., in a tooltip or side panel)
    });
}

function handleCountryHover(event, d){
  const name = d.properties.name;
  tooltip.style('opacity', 1)
    .html(`<strong>${name}</strong>`)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY + 10) + 'px');
}

function handleCountryClick(event, d){
  const name = d.properties.name;
  const votesGiven = __votingData.filter(v => v.Giving_Country === name && (!year || v.Year === year));

  const arrowGroup = mapSvg.selectAll('g.arrows').data([null]);
  arrowGroup.enter().append('g').attr('class', 'arrows').merge(arrowGroup).selectAll('line.arrow')
    .data(votesGiven)
    .join('line')
    .attr('class', 'arrow')
    .attr('x1', d => {
      const fromCountry = geo.find(c => c.properties.name === d.Giving_Country);
      return fromCountry ? projection(d3.geoCentroid(fromCountry))[0] : 0;
    })
    .attr('y1', d => {
      const fromCountry = geo.find(c => c.properties.name === d.Giving_Country);
      return fromCountry ? projection(d3.geoCentroid(fromCountry))[1] : 0;
    })
    .attr('x2', d => {
      const toCountry = geo.find(c => c.properties.name === d.Receiving_Country);
      return toCountry ? projection(d3.geoCentroid(toCountry))[0] : 0;
    })
    .attr('y2', d => {
      const toCountry = geo.find(c => c.properties.name === d.Receiving_Country);
      return toCountry ? projection(d3.geoCentroid(toCountry))[1] : 0;
    })
    .attr('stroke', 'red')
    .attr('stroke-width', 1.5)
    .attr('marker-end', 'url(#arrowhead)');

  mapSvg.select('defs').remove();
  const defs = mapSvg.append('defs');
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 5)
    .attr('refY', 5)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 Z')
    .attr('fill', 'red');
  console.log('Clicked country:', name);
}

// ==================   DOT PLOT  =====================
function drawDotPlot(rows) {
  const aggregatedData = d3.rollups(
    rows,
    v => ({
      count: v.length,
      country: v[0].Country,
      year: v[0].Year,
      song: v[0].Song,
      gender: v[0].Artist_gender,
      groupSolo: v[0].Group_Solo,
      place: v[0].Place,
      normalizedPoints: v[0].Normalized_Points
    }),
    d => d.Artist
  );

  console.log('Aggregated data for dot plot:', aggregatedData);

  const xScale = d3.scalePoint()
    .domain(aggregatedData.map(d => d[0]))
    .range([50, dotSvg.node().getBoundingClientRect().width - 50])
    .padding(0.5);

  const yScale = d3.scalePoint()
    .domain(['Male', 'Female', 'Both'])
    .range([50, dotSvg.node().getBoundingClientRect().height - 50]);

  const sizeScale = d3.scaleSqrt()
    .domain([0, d3.max(aggregatedData, d => d[1].count)])
    .range([5, 20]);

  dotSvg.selectAll('circle')
    .data(aggregatedData)
    .enter().append('circle')
    .attr('cx', d => xScale(d[0]))
    .attr('cy', d => yScale(d[1].gender))
    .attr('r', d => sizeScale(d[1].count))
    .attr('fill', 'steelblue')
    .attr('opacity', 0.7)
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1)
        .html(`<strong>${d[0]}</strong><br>Gender: ${d[1].gender}<br>Count: ${d[1].count}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
    })
    .on('mouseout', () => tooltip.style('opacity', 0));

  console.log('drawDotPlot called with', rows.length, 'rows.');
}

// ==================   LINE CHART + RADAR  =====================
function drawLineChart(rows) {
  const featureSelect = d3.select('#featureSelect');
  const W = lineSvg.node().getBoundingClientRect().width;
  const H = lineSvg.node().getBoundingClientRect().height;

  const xScale = d3.scaleLinear()
      .domain(d3.extent(rows, d => d.Year))
      .range([50, W - 50]);

  const yScale = d3.scaleLinear().range([H - 50, 50]);

  const lineGenerator = d3.line()
      .x(d => xScale(d.Year))
      .y(d => yScale(d.value));

  featureSelect.on('change', function () {
    const f = this.value;
    const winners = rows.filter(r =>
      r.Place === 1 && Number.isFinite(+r[f])
    );

    if (winners.length === 0) {
      console.error(`No usable data for feature “${f}”.`);
      return;
    }

    const aggregated = d3.rollups(
        winners,
        v => d3.mean(v, d => +d[f]),
        d => d.Year
      )
      .map(([Year, value]) => ({ Year, value }))
      .filter(d => Number.isFinite(d.value));

    if (aggregated.length === 0) {
      console.error(`Aggregated data is empty for “${f}”.`);
      return;
    }

    yScale.domain(d3.extent(aggregated, d => d.value)).nice();

    lineSvg.selectAll('.line')
        .data([aggregated])
        .join('path')
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 2)
        .transition().duration(500)
        .attr('d', lineGenerator);

    lineSvg.selectAll('.dot')
        .data(aggregated)
        .join('circle')
        .attr('class', 'dot')
        .attr('r', 5)
        .attr('fill', 'steelblue')
        .attr('cx', d => xScale(d.Year))
        .attr('cy', d => yScale(d.value));

    lineSvg.selectAll('.dot')
        .on('mouseover', (event, d) => {
          tooltip.style('opacity', 1)
            .html(`<strong>Year:</strong> ${d.Year}<br><strong>${f}:</strong> ${d.value.toFixed(2)}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top',  (event.pageY + 10) + 'px');
        })
        .on('mouseout', () => tooltip.style('opacity', 0));
  });

  featureSelect.dispatch('change');
}

// ==================   TREEMAP  =====================
function drawTreemap(rows) {
  const W = treeSvg.node().getBoundingClientRect().width;
  const H = treeSvg.node().getBoundingClientRect().height;

  const bucket = p => {
    const g = Math.ceil(p / 5);
    return g <= 4 ? `${(g - 1) * 5 + 1}‑${g * 5}` : 'Rest';
  };

  const groups = Array.from(
    d3.group(rows, r => bucket(r.Place)),
    ([label, recs]) => {
      const dominant = d3.greatest(FEATURES,
        f => d3.mean(recs, d => +d[f]))[0];
      return { label, count: recs.length, dominantFeature: dominant };
    }
  );

  const root = d3.hierarchy({ children: groups })
      .sum(d => d.count);

  d3.treemap()
    .size([W, H])
    .padding(1)(root);

  const color = d3.scaleOrdinal()
      .domain(FEATURES)
      .range(d3.schemeTableau10);

  const node = treeSvg.selectAll('g.node')
      .data(root.leaves())
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

  node.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => color(d.data.dominantFeature));

  node.append('text')
      .attr('x', 3)
      .attr('y', 12)
      .text(d => d.data.label)
      .attr('font-size', '10px');

  node.on('mouseover', (event, d) => {
        tooltip.style('opacity', 1)
          .html(`<strong>Rank group:</strong> ${d.data.label}<br>
                 <strong>Dominant feature:</strong> ${d.data.dominantFeature}<br>
                 <strong>Songs:</strong> ${d.data.count}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top',  (event.pageY + 10) + 'px');
      })
      .on('mouseout', () => tooltip.style('opacity', 0));
}

// ==================   CORRELATION MATRIX  =====================
function drawCorrelationMatrix(rows) {
  const numericColumns = ['Normalized_Points', 'Song_Quality', 'Place', ...FEATURES];

  const matrix = numericColumns.map(col1 =>
    numericColumns.map(col2 => {
      const values1 = rows.map(r => r[col1]).filter(v => v !== undefined && !isNaN(v));
      const values2 = rows.map(r => r[col2]).filter(v => v !== undefined && !isNaN(v));
      const correlation = calculateCorrelation(values1, values2);
      return { col1, col2, correlation };
    })
  ).flat();

  const corrWidth = corrSvg.node().getBoundingClientRect().width;
  const corrHeight = corrSvg.node().getBoundingClientRect().height;
  const cellSize = Math.min(corrWidth, corrHeight) / numericColumns.length;

  const colorScale = d3.scaleSequential(d3.interpolateRdBu)
    .domain([-1, 1]);

  corrSvg.selectAll('rect')
    .data(matrix)
    .enter().append('rect')
    .attr('x', d => numericColumns.indexOf(d.col1) * cellSize)
    .attr('y', d => numericColumns.indexOf(d.col2) * cellSize)
    .attr('width', cellSize)
    .attr('height', cellSize)
    .attr('fill', d => colorScale(d.correlation))
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1)
        .html(`<strong>${d.col1} vs ${d.col2}</strong><br>Correlation: ${d.correlation.toFixed(2)}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
    })
    .on('mouseout', () => tooltip.style('opacity', 0));

  corrSvg.selectAll('text')
    .data(numericColumns)
    .enter().append('text')
    .attr('x', (d, i) => i * cellSize + cellSize / 2)
    .attr('y', corrHeight - 5)
    .attr('text-anchor', 'middle')
    .text(d => d)
    .attr('font-size', '10px')
    .attr('transform', `rotate(-45, ${corrWidth / 2}, ${corrHeight / 2})`);

  console.log('drawCorrelationMatrix called with', rows.length, 'rows.');
}

function calculateCorrelation(values1, values2) {
  if (values1.length !== values2.length || values1.length === 0) {
    return NaN;
  }
  const mean1 = d3.mean(values1);
  const mean2 = d3.mean(values2);
  const numerator = d3.sum(values1.map((v, i) => (v - mean1) * (values2[i] - mean2)));
  const denominator = Math.sqrt(
    d3.sum(values1.map(v => Math.pow(v - mean1, 2))) *
    d3.sum(values2.map(v => Math.pow(v - mean2, 2)))
  );
  return denominator === 0 ? NaN : numerator / denominator;
}