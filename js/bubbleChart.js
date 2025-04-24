export function drawBubbleChartForGroupSolo(data) {
  // Initialise original data and year filter if not already done
  if (!window.originalData) {
    window.originalData = cleanData(data);
    initYearFilter(window.originalData);
  }

  // Get selected year from the dropdown
  const selectedYear = d3.select('#groupSoloYearSelector').property('value');
  // Filter data based on selected year
  const filteredData = filterByYear(window.originalData, selectedYear);
  // Draw chart using filtered data
  drawChart(filteredData, selectedYear);
}

// Clean and format the dataset
function cleanData(data) {
  return data.map(d => ({
    ...d,
    Year: d.Year ? +d.Year : null,  // Convert year to number or null
    Group_Solo: (!d.Group_Solo || d.Group_Solo.trim().toUpperCase() === 'NA') 
      ? 'Unknown' 
      : d.Group_Solo.trim()
  }));
}

// Initialise the dropdown menu with unique years
function initYearFilter(data) {
  const years = Array.from(new Set(data.map(d => d.Year).filter(y => !isNaN(y)))).sort((a, b) => a - b);
  d3.select('#groupSoloYearSelector')
    .selectAll('option')
    .data(['All', ...years])
    .enter()
    .append('option')
    .attr('value', d => d)
    .text(d => d);
}

// Filter data by selected year
function filterByYear(data, year) {
  return (year === 'All') ? data : data.filter(d => +d.Year === +year);
}

// Render the bubble chart
function drawChart(data, selectedYear) {
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // Group and count data by Group_Solo field
  const groupSoloCounts = d3.rollups(
    data,
    v => v.length,
    d => d.Group_Solo
  ).sort((a, b) => d3.descending(a[1], b[1]));

  // Clear previous chart
  d3.select('#bubbleChart').selectAll('*').remove();

  // Create SVG container
  const svg = d3.select('#bubbleChart')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // Set up scales
  const xScale = d3.scalePoint()
    .domain(groupSoloCounts.map(d => d[0]))
    .range([0, width])
    .padding(0.5);

  const rScale = d3.scaleSqrt()
    .domain([0, d3.max(groupSoloCounts, d => d[1])])
    .range([10, 50]);

  const colourScale = d3.scaleOrdinal(d3.schemeTableau10);

  // Tooltip setup
  const tooltip = d3.select('#bubbleChart')
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('visibility', 'hidden')
    .style('background', 'rgba(0, 0, 0, 0.7)')
    .style('color', '#fff')
    .style('padding', '5px')
    .style('border-radius', '3px')
    .style('font-size', '12px');

  // Draw bubbles
  svg.selectAll('circle')
    .data(groupSoloCounts)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d[0]))
    .attr('cy', height / 2)
    .attr('r', d => rScale(d[1]))
    .attr('fill', d => colourScale(d[0]))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .on('mouseover', function(event, d) {
      tooltip.style('visibility', 'visible').html(`${d[0]}: ${d[1]}`);
    })
    .on('mousemove', function(event) {
      tooltip
        .style('top', `${event.pageY + 10}px`)
        .style('left', `${event.pageX + 10}px`);
    })
    .on('mouseout', () => tooltip.style('visibility', 'hidden'));

  // Add text labels on the bubbles
  svg.selectAll('text.label')
    .data(groupSoloCounts)
    .enter()
    .append('text')
    .attr('class', 'label')
    .attr('x', d => xScale(d[0]))
    .attr('y', height / 2)
    .attr('dy', '.35em')
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', '#fff')
    .text(d => d[0]);

  // Add X axis
  svg.append('g')
    .attr('transform', `translate(0, ${height - 30})`)
    .call(d3.axisBottom(xScale));

  // Add chart title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', -20)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px')
    .text(`Group vs Solo Distribution${selectedYear !== 'All' ? ' (' + selectedYear + ')' : ''}`);
}

// Add listener to re-render chart when year selection changes
d3.select('#groupSoloYearSelector').on('change', () => {
  drawBubbleChartForGroupSolo(window.originalData);
});
