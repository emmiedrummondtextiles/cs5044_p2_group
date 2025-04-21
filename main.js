// ====== CONSTANTS & GLOBALS ====================================================
const CSV_PATH = 'data/eurovision_1998_to_2012.csv';
const FEATURES = [
  'energy', 'duration', 'acousticness', 'danceability', 'tempo', 'speechiness',
  'key', 'liveness', 'loudness', 'valence', 'Happiness'
];

const tooltip   = d3.select('#tooltip');
const mapSvg    = d3.select('#map').append('svg').attr('width','100%').attr('height','100%');
const dotSvg    = d3.select('#dotplotSVG');
const lineSvg   = d3.select('#linechartSVG');
const radarDiv  = d3.select('#radarContainer');
const treeSvg   = d3.select('#treemapSVG');
const corrSvg   = d3.select('#corrMatrixSVG');
const violinDiv = d3.select('#violinContainer');

// Populate feature dropdown
d3.select('#featureSelect').selectAll('option')
  .data(FEATURES)
  .enter().append('option')
    .attr('value', d => d)
    .text(d => d.charAt(0).toUpperCase() + d.slice(1));

// Function to check for invalid or missing values in all fields
function filterInvalidRows(rows) {
  return rows.filter(row => {
    // Check for missing or invalid values in all fields
    return Object.entries(row).every(([key, value]) => {
      // Skip checks for non-feature fields if necessary
      if (key === 'Year' || key === 'Country' || key === 'Artist' || key === 'Song') {
        return value !== undefined && value !== null && value !== '';
      }

      // For numeric fields, ensure the value is a valid number
      if (typeof value === 'number') {
        return !isNaN(value);
      }

      // For string fields, ensure the value is not empty
      if (typeof value === 'string') {
        return value.trim() !== '';
      }

      // For boolean fields, ensure the value is true or false
      if (typeof value === 'boolean') {
        return true;
      }

      // Skip rows with invalid or unknown data types
      return false;
    });
  });
}

// ====== DATA LOADING ==========================================================
Promise.all([
  d3.csv(CSV_PATH, d3.autoType),
  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'),
  d3.csv('data/eurovision_1998_to_2012_voting.csv', d3.autoType)
]).then(([rows, world, votingData]) => {
  // Filter out rows with invalid or missing values
  const validRows = filterInvalidRows(rows);
  console.log(`Filtered rows: ${validRows.length} out of ${rows.length}`);

  // Proceed with initialization using only valid rows
  init(validRows, world, votingData);
});

function init(rows, world, votingData) {
  console.log('CSV rows:', rows.length);
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
  // basic tooltip – fill in actual stats later
  tooltip.style('opacity', 1)
    .html(`<strong>${name}</strong>`)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY + 10) + 'px');
}

function handleCountryClick(event, d){
  const name = d.properties.name;
  // TODO: draw flow arrows for votes given by `name` in selected year / all years
  console.log('Clicked country:', name);
}

// ==================   DOT PLOT  =====================
function drawDotPlot(rows){
  // TODO: aggregate by Artist & Gender then plot jittered dots sized by appearance count
  const aggregatedData = d3.rollups(
    rows,
    v => ({
      count: v.length,
      gender: v[0].Gender,
    }),
    d => d.Artist
  );

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
  const lineChartWidth = lineSvg.node().getBoundingClientRect().width;
  const lineChartHeight = lineSvg.node().getBoundingClientRect().height;

  const xScale = d3.scaleLinear()
    .domain(d3.extent(rows, d => d.Year))
    .range([50, lineChartWidth - 50]);

  const yScale = d3.scaleLinear()
    .range([lineChartHeight - 50, 50]);

  const lineGenerator = d3.line()
    .x(d => xScale(d.Year))
    .y(d => yScale(d.value));

  featureSelect.on('change', function () {
    const selectedFeature = this.value;

    // Ensure the selected feature exists in the dataset
    if (!FEATURES.includes(selectedFeature)) {
      console.error(`Feature "${selectedFeature}" is not valid.`);
      return;
    }

    // Filter rows where Place == 1 (winning songs)
    const winningSongs = rows.filter(r => r.Place === 1);
    if (winningSongs.length === 0) {
      console.error('No winning songs found in the dataset.');
      return;
    }

    // Validate feature values
    const featureValues = winningSongs.map(d => d[selectedFeature]).filter(v => v !== undefined && !isNaN(v));
    if (featureValues.length === 0) {
      console.error(`No valid data available for feature "${selectedFeature}".`);
      return;
    }

    // Update yScale domain based on the selected feature
    yScale.domain(d3.extent(featureValues));

    // Aggregate data by year for the selected feature
    const aggregatedData = d3.rollups(
      winningSongs,
      v => d3.mean(v, d => d[selectedFeature]),
      d => d.Year
    ).map(([year, value]) => ({ Year: year, value }));

    if (aggregatedData.length === 0 || aggregatedData.some(d => isNaN(d.value))) {
      console.error(`Aggregated data is invalid for feature "${selectedFeature}".`);
      return;
    }

    // Bind data to the line
    const line = lineSvg.selectAll('.line').data([aggregatedData]);

    // Enter, update, exit for the line
    line.enter()
      .append('path')
      .attr('class', 'line')
      .merge(line)
      .transition().duration(500)
      .attr('d', lineGenerator)
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 2);

    line.exit().remove();

    // Bind data to dots
    const dots = lineSvg.selectAll('.dot').data(aggregatedData);

    // Enter, update, exit for dots
    dots.enter()
      .append('circle')
      .attr('class', 'dot')
      .merge(dots)
      .transition().duration(500)
      .attr('cx', d => xScale(d.Year))
      .attr('cy', d => yScale(d.value))
      .attr('r', 5)
      .attr('fill', 'steelblue');

    dots.exit().remove();

    // Add tooltip interaction for dots
    lineSvg.selectAll('.dot')
      .on('mouseover', (event, d) => {
        tooltip.style('opacity', 1)
          .html(`<strong>Year:</strong> ${d.Year}<br><strong>${selectedFeature}:</strong> ${d.value.toFixed(2)}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseout', () => tooltip.style('opacity', 0));

    console.log('Feature changed:', selectedFeature);
  });

  // Trigger initial rendering for the default selected feature
  featureSelect.dispatch('change');
  console.log('drawLineChart called with', rows.length, 'rows.');
}

// ==================   TREEMAP  =====================
function drawTreemap(rows){
  // TODO: bucket songs by 5‑place ranks & dominant feature
  const treemapWidth = treeSvg.node().getBoundingClientRect().width;
  const treemapHeight = treeSvg.node().getBoundingClientRect().height;

  const groupedData = d3.rollups(
    rows,
    v => ({
      count: v.length,
      dominantFeature: FEATURES.reduce((a, b) => d3.mean(v, d => d[a]) > d3.mean(v, d => d[b]) ? a : b)
    }),
    d => Math.ceil(d.Place / 5) // Group by 5-place ranks
  );

  const root = d3.hierarchy({ values: groupedData }, d => d[1])
    .sum(d => d.value.count)
    .sort((a, b) => b.value - a.value);

  const treemapLayout = d3.treemap()
    .size([treemapWidth, treemapHeight])
    .padding(1);

  treemapLayout(root);

  const colorScale = d3.scaleOrdinal()
    .domain(FEATURES)
    .range(d3.schemeCategory10);

  treeSvg.selectAll('rect')
    .data(root.leaves())
    .enter().append('rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('width', d => d.x1 - d.x0)
    .attr('height', d => d.y1 - d.y0)
    .attr('fill', d => colorScale(d.data[1].dominantFeature))
    .attr('stroke', '#fff')
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1)
        .html(`<strong>Rank Group:</strong> ${d.data[0]}<br><strong>Dominant Feature:</strong> ${d.data[1].dominantFeature}<br><strong>Count:</strong> ${d.data[1].count}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
    })
    .on('mouseout', () => tooltip.style('opacity', 0));

  treeSvg.selectAll('text')
    .data(root.leaves())
    .enter().append('text')
    .attr('x', d => d.x0 + 5)
    .attr('y', d => d.y0 + 15)
    .text(d => d.data[0])
    .attr('font-size', '10px')
    .attr('fill', '#000');
  console.log('drawTreemap called with', rows.length, 'rows.');
}

// ==================   CORRELATION MATRIX  =====================
function drawCorrelationMatrix(rows){
  // TODO: compute Pearson correlation for numeric columns incl. Normalized_Points, Song_Quality, Place
  const numericColumns = ['Normalized_Points', 'Song_Quality', 'Place', ...FEATURES];
  const matrix = numericColumns.map(col1 => 
    numericColumns.map(col2 => {
      const values1 = rows.map(r => r[col1]);
      const values2 = rows.map(r => r[col2]);
      const correlation = d3.corr(values1, values2); // Assuming d3.corr is available
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