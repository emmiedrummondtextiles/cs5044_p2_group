// Export a function to draw a bar chart based on the provided data
export function drawKeyBarChart(data) {
  // Define margins and dimensions of the chart
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // Select the SVG container and year dropdown selector
  const svgContainer = d3.select('#keyBarChart');
  const selector = d3.select('#yearSelector');

  // Musical‐key mapping (using sharps)
  const keyMap = {
    0: 'C',  1: 'C#', 2: 'D',  3: 'D#',
    4: 'E',  5: 'F',  6: 'F#', 7: 'G',
    8: 'G#', 9: 'A', 10: 'A#',11: 'B'
  };
  const orderedKeys = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  // Data preprocessing: parse numeric key and map to name, unknowns last
  data = data.map(d => {
    const raw = d.key === 'NA' ? null : +d.key;
    const name = raw === null || isNaN(raw)
      ? 'Unknown'
      : keyMap[raw];
    return { ...d, key: name, keyInt: raw };
  });

  // Initialize the year dropdown menu
  const years = ['All', ...Array.from(new Set(data.map(d => d.Year))).sort((a, b) => a - b)];
  selector.selectAll('option')
    .data(years)
    .enter()
    .append('option')
    .attr('value', d => d)
    .text(d => d);

  // Handler to update chart whenever year changes
  selector.on('change', () => updateChart(selector.property('value')));
  updateChart('All'); // initial draw

  function updateChart(selectedYear) {
    // Filter by year
    const yearFiltered = selectedYear === 'All'
      ? data
      : data.filter(d => d.Year === +selectedYear);

    // Group data by key name and count
    const keyCounts = d3.rollups(
      yearFiltered,
      v => v.length,
      d => d.key
    )
    // Sort by pitch order, unknown last
    .sort((a, b) => {
      const iA = orderedKeys.indexOf(a[0]);
      const iB = orderedKeys.indexOf(b[0]);
      return (iA === -1 ? orderedKeys.length : iA)
           - (iB === -1 ? orderedKeys.length : iB);
    });

    // Clear any existing chart content
    svgContainer.selectAll('*').remove();

    if (keyCounts.length === 0) {
      svgContainer.html('<p>No data available for this year.</p>');
      return;
    }

    // Set up scales
    const x = d3.scaleBand()
      .domain(keyCounts.map(d => d[0]))
      .range([margin.left, margin.left + width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(keyCounts, d => d[1])]).nice()
      .range([margin.top + height, margin.top]);

    // Draw axes
    const svg = svgContainer
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    svg.append('g')
      .attr('transform', `translate(0,${margin.top + height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-30)')
      .style('text-anchor', 'end');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    // Draw bars
    svg.selectAll('.bar')
      .data(keyCounts)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d[0]))
      .attr('y', d => y(d[1]))
      .attr('width', x.bandwidth())
      .attr('height', d => margin.top + height - y(d[1]))
      .attr('fill', '#69b3a2');

    // Chart title
    svg.append('text')
      .attr('x', margin.left + width / 2)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text(`Key Distribution - ${selectedYear === 'All' ? 'All Years' : selectedYear}`);
  }
}