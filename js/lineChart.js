import { FEATURES, showTooltip, hideTooltip } from './utils.js';
import { showRadar } from './radar.js';

export function drawLineChart(rows){
  const svg = d3.select('#linechartSVG');
  const W = svg.node().getBoundingClientRect().width;
  const H = svg.node().getBoundingClientRect().height;

  const x = d3.scaleLinear().range([50, W-50]);
  const y = d3.scaleLinear().range([H-50, 50]);
  const line = d3.line().x(d => x(d.Year)).y(d => y(d.value));

  const xG = svg.append('g').attr('transform', `translate(0,${H-50})`);
  const yG = svg.append('g').attr('transform', 'translate(50,0)');

  // Populate the feature select drop-down menu with all as default
  const featureSel = d3.select('#featureSelect');
  const options = ["all", ...FEATURES];
  featureSel.selectAll("option")
    .data(options)
    .join("option")
      .attr("value", d => d)
      .text(d => d === "all" ? "All Features" : d);

  // Set default to all
  featureSel.property('value', 'all');

  // Attach event listener for changes
  featureSel.on('change', update);
  update();

  function update(){
    const f = featureSel.property('value');
    svg.selectAll('g.chart-content').remove(); // remove previous chart content

    // Set margins so that the drawing area uses nearly the full width
    // Left margin for the y-axis; minimal right margin
    const margin = { top: 50, right: 20, bottom: 50, left: 50 };

    // Update scales to use the full width (W is taken from the SVG dimensions)
    x.range([margin.left, W - margin.right]);
    y.range([H - margin.bottom, margin.top]);

    // Append group for chart content
    const group = svg.append('g').attr('class', 'chart-content');

    if(f === 'all'){
      const linesData = FEATURES.map(feat => {
        const wData = rows.filter(r => r.Place === 1 && Number.isFinite(+r[feat]));
        let data = Array.from(
          d3.rollup(wData, v => d3.mean(v, d => +d[feat]), d => d.Year),
          ([Year, val]) => ({ Year: +Year, value: val })
        ).filter(d => Number.isFinite(d.value));
        // Sort data by Year
        data.sort((a, b) => d3.ascending(a.Year, b.Year));
        return { feat, data };
      }).filter(d => d.data.length);

      // Set domains using winning song data
      x.domain(d3.extent(rows.filter(r => r.Place === 1), d => +d.Year));
      y.domain(d3.extent(linesData.flatMap(l => l.data.map(d => d.value)))).nice();
    
      xG.transition().call(d3.axisBottom(x).ticks(6));
      yG.transition().call(d3.axisLeft(y));
    
      const colour = d3.scaleOrdinal().domain(FEATURES).range(d3.schemeTableau10);
      group.selectAll('path.line')
        .data(linesData, d => d.feat)
        .join(
          enter => enter.append('path')
                        .attr('class', 'line')
                        .attr('fill', 'none'),
          update => update,
          exit => exit.remove()
        )
        .attr('stroke', d => colour(d.feat))
        .attr('stroke-width', 2)
        .transition()
        .attr('d', d => line.curve(d3.curveMonotoneX)(d.data));
    
      // Append legend for feature colour coding
      const legend = group.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${W - margin.right - 100}, ${margin.top})`);

      legend.selectAll('g.legend-item')
        .data(linesData)
        .enter()
        .append('g')
          .attr('class', 'legend-item')
          .attr('transform', (d, i) => `translate(0, ${i * 20})`)
          .call(g => {
             g.append('rect')
              .attr('width', 12)
              .attr('height', 12)
              .attr('fill', d => colour(d.feat));
             g.append('text')
              .attr('x', 16)
              .attr('y', 6)
              .attr('dy', '0.35em')
              .attr('font-size', '10px')
              .text(d => d.feat);
          });
    
    } else {
      // Single feature view: calculate and draw a single line with dots.
      let data = Array.from(
        d3.rollup(
          rows.filter(r => r.Place === 1 && Number.isFinite(+r[f])),
          v => d3.mean(v, d => +d[f]),
          d => d.Year
        ),
        ([Year, val]) => ({ Year: +Year, value: val })
      ).filter(d => Number.isFinite(d.value));
      
      data.sort((a, b) => d3.ascending(a.Year, b.Year));
      
      x.domain(d3.extent(data, d => d.Year));
      y.domain(d3.extent(data, d => d.value)).nice();
      
      xG.transition().call(d3.axisBottom(x).ticks(6));
      yG.transition().call(d3.axisLeft(y));
      
      group.selectAll('path.line')
        .data([data])
        .join(
          enter => enter.append('path')
                         .attr('class', 'line')
                         .attr('fill', 'none')
                         .attr('stroke', 'steelblue'),
          update => update,
          exit => exit.remove()
        )
        .attr('stroke-width', 2)
        .transition()
        .attr('d', line.curve(d3.curveMonotoneX));
      
      group.selectAll('circle.dot')
        .data(data)
        .join('circle')
        .attr('class', 'dot')
        .attr('r', 5)
        .attr('fill', 'steelblue')
        .attr('cx', d => x(d.Year))
        .attr('cy', d => y(d.value))
        .on('mouseover', (e, d) => {
          showTooltip(
            `<strong>Year:</strong> ${d.Year}<br><strong>${f}:</strong> ${d.value.toFixed(2)}`,
            [e.pageX+10, e.pageY+10]
          );
        })
        .on('mouseout', hideTooltip)
        .on('click', (_, d) => {
          const song = rows.find(r => +r.Year === d.Year && r.Place === 1);
          showRadar(song);
        });
    }
  }
}