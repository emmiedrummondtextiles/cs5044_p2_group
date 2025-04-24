export function drawTimeSigBarChart(data) {
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // Replace 'NA' with 'Unknown'
  data = data.map(d => ({
    ...d,
    time_signature: d.time_signature === 'NA' ? 'Unknown' : d.time_signature
  }));

  // Populate year dropdown (with "All" option)
  const years = Array.from(new Set(data.map(d => d.Year))).sort((a, b) => a - b);
  years.unshift('All');
  const yearSelector1 = d3.select('#yearSelector1');
  yearSelector1.selectAll('option')
    .data(years)
    .enter()
    .append('option')
    .attr('value', d => d)
    .text(d => d);

  yearSelector1.on('change', function () {
    updateChart(this.value);
  });
  updateChart('All');

  function updateChart(selectedYear) {
    let filteredData = selectedYear === 'All'
      ? data
      : data.filter(d => d.Year === +selectedYear);

    // Group by time_signature and count
    const timeSignatureCounts = d3.rollups(
      filteredData,
      v => v.length,
      d => d.time_signature
    )
    // Sort by numeric beats, unknown last
    .sort((a, b) => {
      const va = a[0] === 'Unknown' ? Infinity : +a[0];
      const vb = b[0] === 'Unknown' ? Infinity : +b[0];
      return va - vb;
    });

    const container = d3.select('#timeSigBarChart');
    container.selectAll('*').remove();

    if (timeSignatureCounts.length === 0) {
      container.html('<p>No data available for this year.</p>');
      return;
    }

    const svg = container
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
      .domain([0, d3.max(timeSignatureCounts, d => d[1])]).nice()
      .range([height, 0]);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-30)')
      .style('text-anchor', 'end');

    svg.append('g')
      .call(d3.axisLeft(y));

    // Bars
    svg.selectAll('rect')
      .data(timeSignatureCounts)
      .enter()
      .append('rect')
      .attr('x', d => x(d[0]))
      .attr('y', d => y(d[1]))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d[1]))
      .attr('fill', '#4682b4');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text(`Time Signature Distribution – ${selectedYear === 'All' ? 'All Years' : selectedYear}`);
  }
}