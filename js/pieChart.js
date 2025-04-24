export function drawPieChart(data) {
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // Replace 'NA' with 'Unknown', change '0' to 'Others', and '1' to 'English' in the Song_In_English column
  data = data.map(d => ({
    ...d,
    'Song_In_English': d['Song_In_English'] === 'NA' ? 'Unknown' : 
                        d['Song_In_English'] === 0 ? 'Others' : 
                        d['Song_In_English'] === 1 ? 'English' : d['Song_In_English']
  }));

  // Get all unique values from the Song_In_English column and count them
  const songInEnglishCounts = d3.rollups(
    data,
    v => v.length,
    d => d['Song_In_English']
  ).sort((a, b) => d3.descending(a[1], b[1]));

  // Clear the previous chart
  d3.select('#pieChart').selectAll('*').remove();

  const svg = d3.select('#pieChart')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${width / 2 + margin.left}, ${height / 2 + margin.top})`);

  const radius = Math.min(width, height) / 2;
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Define the pie generator
  const pie = d3.pie()
    .value(d => d[1]);

  // Define the arc generator
  const arc = d3.arc()
    .outerRadius(radius - 10)
    .innerRadius(0);

  // Create the pie chart arcs
  const arcs = svg.selectAll('.arc')
    .data(pie(songInEnglishCounts))  
    .enter()
    .append('g')
    .attr('class', 'arc');

  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => colorScale(d.data[0]))  // Apply appropriate color mapping
    .attr('stroke', 'white')  // Add white borders to separate arcs
    .attr('stroke-width', 1);

  // Add labels to each arc
  arcs.append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)  // Position labels at the center of each arc
    .attr('dy', '.35em')
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .text(d => d.data[0]);  // Display label for each section (English or Others)

  // Create a tooltip element
  const tooltip = d3.select('#pieChart')
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('visibility', 'hidden')
    .style('background', 'rgba(0, 0, 0, 0.7)')
    .style('color', '#fff')
    .style('padding', '5px')
    .style('border-radius', '3px')
    .style('font-size', '12px');

  // Add mouse events: mouseover and mouseout for tooltip functionality
  arcs.on('mouseover', function(event, d) {
    tooltip
      .style('visibility', 'visible')
      .html(`${d.data[0]}: ${d.data[1]} items`);  // Display category and count
  })
  .on('mousemove', function(event) {
    tooltip
      .style('top', `${event.pageY + 10}px`)  // Adjust tooltip position
      .style('left', `${event.pageX + 10}px`);
  })
  .on('mouseout', function() {
    tooltip.style('visibility', 'hidden');  // Hide tooltip
  });

  // Add chart title
  svg.append('text')
    .attr('x', 0)
    .attr('y', -radius - 10)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px')
    .text('Is the song in English?');

  // Get unique year values and sort them
  const years = Array.from(new Set(data.map(d => d['Year']))).sort((a, b) => a - b);

  // Use the existing select element with id "engNonEngYearSelector"
  const yearSelect = d3.select('#engNonEngYearSelector');

  // Attach event listener for changes on the existing select element
  yearSelect.on('change', function() {
    const selectedYear = this.value;
    console.log('Selected Year:', selectedYear);
    // Update data and redraw pie chart based on selected year
    updatePieChartForYear(selectedYear);
  });

  // Clear any previous options (if necessary)
  yearSelect.selectAll('option').remove();

  // Add an "All" option for the filter
  yearSelect.append('option')
    .attr('value', 'All')
    .text('All');

  // Populate the year options
  yearSelect.selectAll('option.yearOption')
    .data(years)
    .join('option')
      .attr('class', 'yearOption')
      .attr('value', d => d)
      .text(d => d);

  // Function to update the pie chart based on the selected year
  function updatePieChartForYear(year) {
    // Filter data (if "All" is selected, do not filter)
    let filteredData = year === 'All' ? data : data.filter(d => d['Year'] === +year);  

    // Recompute counts for the Song_In_English column
    const updatedSongInEnglishCounts = d3.rollups(
      filteredData,
      v => v.length,
      d => d['Song_In_English']
    ).sort((a, b) => d3.descending(a[1], b[1]));

    // Clear the existing arcs
    svg.selectAll('.arc').remove();

    // Create new arcs using the updated data
    const newArcs = svg.selectAll('.arc')
      .data(pie(updatedSongInEnglishCounts))
      .enter()
      .append('g')
      .attr('class', 'arc');

    newArcs.append('path')
      .attr('d', arc)
      .attr('fill', d => colorScale(d.data[0]))  // Apply appropriate color mapping
      .attr('stroke', 'white')  // Add white borders to separate arcs
      .attr('stroke-width', 1);

    // Add labels to each updated arc
    newArcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)  // Position labels at the center of each arc
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(d => d.data[0]);  // Display label for each section (English or Others)

    // Rebind mouse events to ensure tooltip displays correctly for updated arcs
    newArcs.on('mouseover', function(event, d) {
      tooltip
        .style('visibility', 'visible')
        .html(`${d.data[0]}: ${d.data[1]} items`);
    })
    .on('mousemove', function(event) {
      tooltip
        .style('top', `${event.pageY + 10}px`)
        .style('left', `${event.pageX + 10}px`);
    })
    .on('mouseout', function() {
      tooltip.style('visibility', 'hidden');
    });
  }
}
