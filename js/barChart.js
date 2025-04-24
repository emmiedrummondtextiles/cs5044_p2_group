// Export a function to draw a bar chart based on the provided data
export function drawBarChart(data) {
  // Define margins and dimensions of the chart
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // Select the SVG container and year dropdown selector
  const svgContainer = d3.select('#barChart');
  const selector = d3.select('#yearSelector');

  // Data preprocessing: Replace 'NA' with 'Unknown' in the key field
  data = data.map(d => ({ ...d, key: d.key === 'NA' ? 'Unknown' : d.key }));

  // Initialize the year dropdown menu
  const years = ['All', ...Array.from(new Set(data.map(d => d.Year))).sort()];
  selector.selectAll('option')
    .data(years)
    .enter()
    .append('option')
    .attr('value', d => d)
    .text(d => d);

  // Bind change event to dropdown to update chart when selection changes
  selector.on('change', () => updateChart(selector.property('value')));

  // Initial chart rendering with all data
  updateChart('All');

  // Function to update the chart based on selected year
  function updateChart(selectedYear) {
    // Filter data by selected year, or show all data if 'All' is selected
    const yearFiltered = selectedYear === 'All'
      ? data
      : data.filter(d => d.Year === +selectedYear);

    // Group data by key and count occurrences
    const keyCounts = d3.rollups(
      yearFiltered,
      v => v.length,
      d => d.key
    ).sort((a, b) => d3.descending(a[1], b[1]));

    // Clear any existing chart content
    svgContainer.selectAll('*').remove();

    // Display message if no data is available
    if (keyCounts.length === 0) {
      svgContainer.html('<p>No data available for this year.</p>');
      return;
    }

    // Append new SVG element with proper size and transformation
    const svg = svgContainer.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Define x and y scales
    const x = d3.scaleBand()
      .domain(keyCounts.map(d => d[0]))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(keyCounts, d => d[1])])
      .nice()
      .range([height, 0]);

    // Define color scale
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Draw x-axis with rotated labels
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    // Draw y-axis
    svg.append('g').call(d3.axisLeft(y));

    // Draw bars
    svg.selectAll('rect')
      .data(keyCounts)
      .enter()
      .append('rect')
      .attr('x', d => x(d[0]))
      .attr('y', d => y(d[1]))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d[1]))
      .attr('fill', d => colorScale(d[0]))
      .on('mouseover', (event, d) => showTooltip(svg, x(d[0]), y(d[1]), d[1], x.bandwidth()))
      .on('mouseout', () => svg.select('#tooltip').remove());

    // Chart title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text(`Key Distribution - ${selectedYear === 'All' ? 'All Years' : selectedYear}`);
  }

  // Function to show tooltip above the bar
  function showTooltip(svg, xPos, yPos, text, barWidth) {
    svg.select('#tooltip').remove(); // Remove existing tooltip if any
    svg.append('text')
      .attr('id', 'tooltip')
      .attr('x', xPos + barWidth / 2)
      .attr('y', yPos - 10)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', 'black')
      .text(text);
  }
}
