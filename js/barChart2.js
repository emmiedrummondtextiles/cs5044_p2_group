export function drawBarChart2(data) {
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // Replace 'NA' with 'Unknown'
  data = data.map(d => ({
    ...d,
    time_signature: d.time_signature === 'NA' ? 'Unknown' : d.time_signature
  }));

  // Get all years and populate the dropdown menu, add "All" option
  const years = Array.from(new Set(data.map(d => d.Year))).sort();
  years.unshift('All');  // Add 'All' at the beginning of the year list

  const yearSelector1 = d3.select('#yearSelector1'); // Ensure this matches your HTML
  yearSelector1.selectAll('option')
    .data(years)
    .enter()
    .append('option')
    .attr('value', d => d)
    .text(d => d);

  // Initially display data for all years
  updateChart('All');

  // Update chart when the user selects a different year
  yearSelector1.on('change', function () {
    const selectedYear = this.value;
    updateChart(selectedYear);
  });

  function updateChart(selectedYear) {
    let filteredData;

    // Filter by year
    if (selectedYear === 'All') {
      filteredData = data;  // Show data for all years
    } else {
      filteredData = data.filter(d => d.Year === +selectedYear);  // Force selectedYear to number
    }

    console.log('Selected Year:', selectedYear);  // Debug: log selected year
    console.log('Filtered Data:', filteredData);  // Debug: log filtered data

    // Aggregate and sort time_signature frequencies
    const timeSignatureCounts = d3.rollups(
      filteredData,
      v => v.length,
      d => d.time_signature
    ).sort((a, b) => d3.descending(a[1], b[1]));

    // If there's no data, show a message
    if (timeSignatureCounts.length === 0) {
      d3.select('#barChart2').html('<p>No data available for this year.</p>');
      return;
    }

    // Clear old chart
    d3.select('#barChart2').selectAll('*').remove();

    const svg = d3.select('#barChart2')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(timeSignatureCounts.map(d => d[0]))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(timeSignatureCounts, d => d[1])])
      .nice()
      .range([height, 0]);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    svg.append('g')
      .call(d3.axisLeft(y));

    // Create a color scale based on time_signature values
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const bars = svg.selectAll('rect')
      .data(timeSignatureCounts)
      .enter()
      .append('rect')
      .attr('x', d => x(d[0]))
      .attr('y', d => y(d[1]))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d[1]))
      .attr('fill', d => colorScale(d[0]));  // Assign color based on time_signature

    // Add data labels
    bars.on('mouseover', function (event, d) {
      // Show data label on hover
      svg.selectAll('#tooltip')  // Find any existing tooltip
        .remove();  // Remove all old tooltips

      const tooltip = svg.append('text')
        .attr('id', 'tooltip')
        .attr('x', x(d[0]) + x.bandwidth() / 2)
        .attr('y', y(d[1]) - 10)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', 'black')
        .text(d[1]);  // Show frequency value
    })
    .on('mouseout', function () {
      // Remove data label when mouse leaves
      d3.select('#tooltip').remove();
    });

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text(`Time Signature Distribution - Year ${selectedYear === 'All' ? 'All Years' : selectedYear}`);
  }
}
