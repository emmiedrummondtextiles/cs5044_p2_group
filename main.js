// ====== CONSTANTS & GLOBALS ====================================================
const FEATURES = [
  'energy', 'duration', 'acousticness', 'danceability', 'tempo', 'speechiness',
  'liveness', 'loudness', 'valence', 'Happiness'
];

let countryInfo = null; // pre-computed country stats

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

function normalizeSongFeatures(rows) {
  const featuresToNormalize = ['energy', 'duration', 'tempo', 'Happiness', 'loudness'];
  featuresToNormalize.forEach(feature => {
    // Calculate min and max for the given feature
    const [min, max] = d3.extent(rows, d => +d[feature]);
    // Update each row by replacing the raw value with its normalized value.
    rows.forEach(d => {
      if (d[feature] != null && max > min) {
        d[feature] = (d[feature] - min) / (max - min);
      } else {
        d[feature] = 0; // fallback if the value is missing or invalid
      }
    });
  });
}

/* --- helpers (put near the top) ----------------------------------- */
function countryStats(rows) {
  /* pre‑compute once and cache in a Map */
  const byCountry = d3.group(rows, d => d.Country);
  return new Map(
    Array.from(byCountry, ([cty, recs]) => {
      const wins        = recs.filter(r => r.Place === 1).length;
      const top5        = recs.filter(r => r.Place <= 5).length;
      const avgRank     = d3.mean(recs, r => r.Place);
      const sumPoints   = d3.sum(recs, r => r.Normalized_Points);
      return [cty, { wins, top5, avgRank, sumPoints }];
    })
  );
}

// Populate feature dropdown
d3.select('#featureSelect').selectAll('option')
  .data(['all', ...FEATURES])
  .enter().append('option')
    .attr('value', d => d)
    .text(d => d === 'all' ? 'All Features' : d.charAt(0).toUpperCase() + d.slice(1));

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

  normalizeSongFeatures(rows);
  countryInfo = countryStats(rows);

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

function handleCountryHover(evt, d) {
  const name   = d.properties.name;
  const stats  = countryInfo.get(name);
  tooltip.style('opacity', 1)
    .html(stats
      ? `<strong>${name}</strong><br>
         Wins: ${stats.wins}<br>
         Top‑5 finishes: ${stats.top5}<br>
         Avg. rank: ${stats.avgRank.toFixed(1)}`
      : `<strong>${name}</strong><br>No data`)
    .style('left',  (evt.pageX + 12) + 'px')
    .style('top',   (evt.pageY + 12) + 'px');
}

function handleCountryClick(event, d){
  const name = d.properties.name;
  const yr = +d3.select('#yearSlider').property('value');   // current slider year
  const votes = __votingData.filter(v =>
    v.Giving_Country === name && (isNaN(yr) || v.Year === yr));

  const links = votes.map(v => {
    const src = geo.find(c => c.properties.name === v.Giving_Country);
    const tgt = geo.find(c => c.properties.name === v.Receiving_Country);
    if (!src || !tgt) return null;
    return {
      value : +v.Points,   // raw points (0–12)
      coords: {
        source: projection(d3.geoCentroid(src)),
        target: projection(d3.geoCentroid(tgt))
      }
    };
  }).filter(Boolean);

  /* update selection --------------------------------------------------*/
  const g = mapSvg.selectAll('g.flow').data([null]).join('g').attr('class','flow');

  const scaleW = d3.scaleLinear()
    .domain(d3.extent(links, l => l.value)).range([0.8, 4]);

  const linkSel = g.selectAll('path').data(links, (d,i)=>i);

  linkSel.join(
    enter => enter.append('path')
        .attr('fill','none')
        .attr('stroke','tomato')
        .attr('stroke-opacity',.7)
        .attr('marker-end','url(#arrowhead)')
      .merge(linkSel)
        .attr('stroke-width', d => scaleW(d.value))
        .attr('d', d => {
          const [x1,y1] = d.coords.source;
          const [x2,y2] = d.coords.target;
          const dx = x2-x1, dy = y2-y1;
          const dr = Math.sqrt(dx*dx + dy*dy)*0.8;      // arc radius
          return `M${x1},${y1}A${dr},${dr} 0 0,1 ${x2},${y2}`;
        }),
    exit => exit.remove()
  );
}

// ==================   DOT PLOT  =====================
function drawDotPlot(rows) {
  /* aggregate exactly as spec’d */
  const artists = d3.rollups(
    rows,
    v => ({
      appearances : v.length,
      country     : v[0].Country,
      gender      : v[0].Artist_gender ?? 'N/A',
      totalPoints : d3.sum(v, r => r.Normalized_Points),
      years       : Array.from(new Set(v.map(r => r.Year))).join(', '),
      songs       : v.map(r => r.Song).join('; ')
    }),
    d => d.Artist
  ).map(([Artist, stats]) => ({ Artist, ...stats }));

  const width  = dotSvg.attr('width') || dotSvg.node().getBoundingClientRect().width;
  const height = dotSvg.attr('height')|| dotSvg.node().getBoundingClientRect().height;

  const xScale = d3.scalePoint()
      .domain(['Male','Female','Both','N/A'])
      .range([80, width-40])
      .padding(0.5);

  const yScale = d3.scaleLinear()
      .domain([0, d3.max(artists, d => d.totalPoints)]).nice()
      .range([height-40, 40]);

  const rScale = d3.scaleSqrt()
      .domain(d3.extent(artists, d => d.appearances))
      .range([4,18]);

  dotSvg.selectAll('g.axis').remove();
  dotSvg.append('g').attr('class','axis')
      .attr('transform',`translate(0,${height-40})`)
      .call(d3.axisBottom(xScale));
  dotSvg.append('g').attr('class','axis')
      .attr('transform',`translate(60,0)`)
      .call(d3.axisLeft(yScale));

  const dots = dotSvg.selectAll('circle')
      .data(artists, d => d.Artist)
      .join('circle')
      .attr('cx', d => xScale(d.gender) + (Math.random()-0.5)*12)  // jitter
      .attr('cy', d => yScale(d.totalPoints))
      .attr('r',  d => rScale(d.appearances))
      .attr('fill','steelblue')
      .attr('fill-opacity',0.6)
      .attr('stroke','#333');

  /* tooltip ----------------------------------------------------------*/
  dots.on('mouseover', (evt,d)=>{
        tooltip.style('opacity',1)
          .html(`<strong>${d.Artist}</strong> (${d.country})<br>
                 Σ points: ${d.totalPoints}<br>
                 Appearances: ${d.appearances}<br>
                 Years: ${d.years}<br>
                 Songs: ${d.songs}`)
          .style('left',(evt.pageX+12)+'px')
          .style('top', (evt.pageY+12)+'px');
      })
      .on('mouseout', ()=>tooltip.style('opacity',0))
      .on('click', (evt,d) => {
        const row = rows.find(r => r.Year === d.Year && r.Place === 1);
        showRadar(row);
      });
}

function showRadar(song) {
  radarDiv.selectAll('*').remove();
  if (!song) return;

  const size   = 260;
  const radius = size/2 - 30;
  const cfg = { levels: 5 };

  const data = FEATURES.map(f => ({ axis:f, value:+song[f] || 0 }));
  const maxV = 1;   // we normalised earlier

  const angle = i => (Math.PI*2 / FEATURES.length)*i - Math.PI/2;
  const rScale = d3.scaleLinear().domain([0,maxV]).range([0,radius]);

  const svg = radarDiv.append('svg')
      .attr('width', size).attr('height', size)
    .append('g')
      .attr('transform',`translate(${size/2},${size/2})`);

  /* grid */
  d3.range(1,cfg.levels+1).forEach(level=>{
    svg.append('circle')
      .attr('r', radius*level/cfg.levels)
      .attr('fill','none')
      .attr('stroke','#ccc');
  });

  /* axes + labels */
  svg.selectAll('line.axis')
    .data(FEATURES).enter()
    .append('line')
      .attr('x1',0).attr('y1',0)
      .attr('x2',(d,i)=>rScale(maxV)*Math.cos(angle(i)))
      .attr('y2',(d,i)=>rScale(maxV)*Math.sin(angle(i)))
      .attr('stroke','#999');

  svg.selectAll('text.label')
    .data(FEATURES).enter()
    .append('text')
      .attr('x',(d,i)=>rScale(maxV+0.1)*Math.cos(angle(i)))
      .attr('y',(d,i)=>rScale(maxV+0.1)*Math.sin(angle(i)))
      .attr('dy','0.35em')
      .attr('text-anchor','middle')
      .attr('font-size','10px')
      .text(d=>d);

  /* polygon */
  const line = d3.lineRadial()
      .radius(d => rScale(d.value))
      .angle((d,i)=>angle(i));

  svg.append('path')
      .datum(data.concat([data[0]]))      // closed shape
      .attr('d',line)
      .attr('fill','orange')
      .attr('fill-opacity',0.5)
      .attr('stroke','orangered')
      .attr('stroke-width',2);

  radarDiv.append('p')
     .style('margin','0.25rem 0')
     .html(`<strong>${song.Year}</strong> winner: <em>${song.Song}</em> (${song.Country})`);
}

// ==================   LINE CHART + RADAR  =====================
function drawLineChart(rows) {
  const featureSelect = d3.select('#featureSelect');
  const W = lineSvg.node().getBoundingClientRect().width;
  const H = lineSvg.node().getBoundingClientRect().height;
  
  // Create groups for axes if they don't exist.
  let xAxisGroup = lineSvg.select('.x-axis');
  if (xAxisGroup.empty()) {
    xAxisGroup = lineSvg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${H - 50})`);
  }
  
  let yAxisGroup = lineSvg.select('.y-axis');
  if (yAxisGroup.empty()) {
    yAxisGroup = lineSvg.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(50, 0)`);
  }
  
  // Add axis labels (if not existing)
  let xLabel = lineSvg.select('.x-label');
  if (xLabel.empty()) {
    xLabel = lineSvg.append('text')
      .attr('class', 'x-label')
      .attr('text-anchor', 'middle')
      .attr('x', W / 2)
      .attr('y', H - 10)
      .text('Year');
  }
  
  let yLabel = lineSvg.select('.y-label');
  if (yLabel.empty()) {
    yLabel = lineSvg.append('text')
      .attr('class', 'y-label')
      .attr('text-anchor', 'middle')
      .attr('transform', `rotate(-90)`)
      .attr('x', -H / 2)
      .attr('y', 15)
      .text('Average Value');
  }
  
  const xScale = d3.scaleLinear()
      .range([50, W - 50]);
  const yScale = d3.scaleLinear().range([H - 50, 50]);
  
  const lineGenerator = d3.line()
      .x(d => xScale(d.Year))
      .y(d => yScale(d.value));
  
  featureSelect.on('change', function () {
    const f = this.value;
    
    if (f === 'all') {
      // For each feature, compute aggregated data
      const linesData = FEATURES.map(feature => {
        const winners = rows.filter(r =>
          r.Place === 1 && Number.isFinite(+r[feature])
        );
        const aggregated = d3.rollups(
          winners,
          v => d3.mean(v, d => +d[feature]),
          d => d.Year
        )
          .map(([Year, value]) => ({ Year, value }))
          .filter(d => Number.isFinite(d.value));
        return { feature, data: aggregated };
      }).filter(line => line.data.length > 0);
      
      // Set xScale domain based on year extent from all winners (for Place === 1)
      const allYears = rows.filter(r => r.Place === 1).map(r => r.Year);
      xScale.domain(d3.extent(allYears));
      
      // Set yScale domain from all values from all features
      const allValues = linesData.flatMap(l => l.data.map(d => d.value));
      yScale.domain(d3.extent(allValues)).nice();
      
      // Update axes
      xAxisGroup.transition().duration(500).call(d3.axisBottom(xScale).ticks(6));
      yAxisGroup.transition().duration(500).call(d3.axisLeft(yScale));
      
      // Color scale for the features
      const color = d3.scaleOrdinal()
        .domain(FEATURES)
        .range(d3.schemeTableau10);
      
      // Draw one line per feature
      const lines = lineSvg.selectAll('.line').data(linesData, d => d.feature);
      lines.enter()
        .append('path')
          .attr('class', 'line')
          .attr('fill', 'none')
          .attr('stroke-width', 2)
        .merge(lines)
        .transition().duration(500)
          .attr('stroke', d => color(d.feature))
          .attr('d', d => lineGenerator(d.data));
      lines.exit().remove();
      
      // Optionally, remove individual dots when in multi-line mode
      lineSvg.selectAll('.dot').remove();
      
    } else {
      // Single feature: filter winners with valid numbers.
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
      
      // Set x and y scales based on aggregated data.
      xScale.domain(d3.extent(aggregated, d => d.Year));
      yScale.domain(d3.extent(aggregated, d => d.value)).nice();
      
      // Update axes
      xAxisGroup.transition().duration(500).call(d3.axisBottom(xScale).ticks(6));
      yAxisGroup.transition().duration(500).call(d3.axisLeft(yScale));
      
      // Draw the single line.
      const linePath = lineSvg.selectAll('.line').data([aggregated]);
      linePath.enter()
        .append('path')
          .attr('class', 'line')
          .attr('fill', 'none')
          .attr('stroke', 'steelblue')
          .attr('stroke-width', 2)
        .merge(linePath)
        .transition().duration(500)
          .attr('d', lineGenerator);
      linePath.exit().remove();
      
      // Draw dots for the selected feature.
      const dots = lineSvg.selectAll('.dot').data(aggregated);
      dots.enter()
        .append('circle')
          .attr('class', 'dot')
          .attr('r', 5)
          .attr('fill', 'steelblue')
        .merge(dots)
        .transition().duration(500)
          .attr('cx', d => xScale(d.Year))
          .attr('cy', d => yScale(d.value));
      dots.exit().remove();
      
      // Add tooltip interactions with dots.
      lineSvg.selectAll('.dot')
      .on('mouseover', (event, d) => {
          tooltip.style('opacity', 1)
            .html(`<strong>Year:</strong> ${d.Year}<br>
                  <strong>${f}:</strong> ${d.value.toFixed(2)}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top',  (event.pageY  + 10) + 'px');
      })
      .on('mouseout', () => tooltip.style('opacity', 0))
      .on('click', (event, d) => {
          const song = rows.find(r => r.Year === d.Year && r.Place === 1);
          showRadar(song);
      });
    }
  });
  
  // Initialize chart by dispatching the change event.
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
        f => d3.mean(recs, d => +d[f]));      
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
    .on('mouseout', () => tooltip.style('opacity', 0))
    .on('click', (_,d) => {
      if (d.col1 === d.col2) return;
      showViolin(d.col1, d.col2, rows);
    });

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

function showViolin(f1, f2, rows) {
  violinDiv.selectAll('*').remove();
  const width=320, height=260, padding=40;

  const data = [f1,f2].map(f => rows
      .map(r => +r[f])
      .filter(Number.isFinite));

  const y = d3.scaleLinear()
      .domain([0, d3.max(data.flat())]).nice()
      .range([height-padding, padding]);

  const x = d3.scalePoint().domain([f1,f2]).range([padding, width-padding]).padding(0.7);

  const svg = violinDiv.append('svg')
      .attr('width', width).attr('height', height);

  /* kernel density estimation ---------------------------------------*/
  const kde = (arr) => d3.bin().domain(y.domain()).thresholds(25)(arr);
  const maxDensity = d3.max(data, d => d3.max(kde(d), b=>b.length));

  const xScaleDensity = d3.scaleLinear().domain([0, maxDensity]).range([0,30]);

  svg.selectAll('g.violin')
    .data(data)
    .join('g')
      .attr('transform',(d,i)=>`translate(${x([f1,f2][i])},0)`)
      .each(function(arr,i){
        const group = d3.select(this);
        const bins = kde(arr);
        const area = d3.area()
          .x0(b => -xScaleDensity(b.length))
          .x1(b =>  xScaleDensity(b.length))
          .y (b => y(b.x0));

        group.append('path')
          .datum(bins)
          .attr('d',area.curve(d3.curveCatmullRom))
          .attr('fill','steelblue')
          .attr('fill-opacity',0.6)
          .attr('stroke','#333');
      });

  svg.append('g').attr('transform',`translate(${padding},0)`)
      .call(d3.axisLeft(y));
  svg.append('g').attr('transform',`translate(0,${height-padding})`)
      .call(d3.axisBottom(x));
}