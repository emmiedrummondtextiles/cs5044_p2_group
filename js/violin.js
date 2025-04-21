// violin.js ---------------------------------------------------
export function showViolin(f1, f2, rows){
    const div = d3.select('#violinContainer');
    div.selectAll('*').remove();
    const width = 320, height = 260, pad = 40;
  
    const data = [f1, f2].map(f => rows.map(r => +r[f]).filter(Number.isFinite));
    const y = d3.scaleLinear()
                .domain([0, d3.max(data.flat())])
                .nice()
                .range([height - pad, pad]);
    const x = d3.scalePoint()
                .domain([f1, f2])
                .range([pad, width - pad])
                .padding(0.7);
  
    const svg = div.append('svg')
                   .attr('width', width)
                   .attr('height', height);
  
    const kde = arr => d3.bin()
                         .domain(y.domain())
                         .thresholds(25)(arr);
    const maxD = d3.max(data, d => d3.max(kde(d), b => b.length));
    const xd = d3.scaleLinear().domain([0, maxD]).range([0, 30]);
  
    // Draw axes
    svg.append('g')
       .attr('transform', `translate(${pad},0)`)
       .call(d3.axisLeft(y));
       
    svg.append('g')
       .attr('transform', `translate(0,${height - pad})`)
       .call(d3.axisBottom(x));
  
    // Add y-axis label
    svg.append('text')
       .attr('class', 'y-axis-label')
       .attr('x', pad - 30)
       .attr('y', height / 2)
       .attr('text-anchor', 'middle')
       .attr('transform', `rotate(-90,${pad - 30},${height / 2})`)
       .attr('font-size', '12px')
       .attr('fill', '#333')
       .text('Value');
  
    // Add x-axis label
    svg.append('text')
       .attr('class', 'x-axis-label')
       .attr('x', width / 2)
       .attr('y', height - 5)
       .attr('text-anchor', 'middle')
       .attr('font-size', '12px')
       .attr('fill', '#333')
       .text('Feature');
  
    // Draw violins for each feature
    svg.selectAll('g.violin')
       .data(data)
       .enter()
       .append('g')
         .attr('class', 'violin')
         .attr('transform', (d, i) => `translate(${x([f1, f2][i])},0)`)
         .append('path')
           .datum(d => kde(d))
           .attr('d', d3.area()
             .x0(b => -xd(b.length))
             .x1(b => xd(b.length))
             .y(b => y(b.x0))
             .curve(d3.curveCatmullRom))
           .attr('fill', 'steelblue')
           .attr('fill-opacity', 0.6)
           .attr('stroke', '#333');
  
    // Add legend
    const legendGroup = svg.append('g')
       .attr('class', 'legend')
       .attr('transform', `translate(${width - pad - 110}, ${pad})`);
       
    legendGroup.append('rect')
       .attr('x', 0)
       .attr('y', 0)
       .attr('width', 12)
       .attr('height', 12)
       .attr('fill', 'steelblue')
       .attr('fill-opacity', 0.6)
       .attr('stroke', '#333');
    
    legendGroup.append('text')
       .attr('x', 18)
       .attr('y', 10)
       .attr('font-size', '10px')
       .attr('fill', '#333')
       .text('Density estimation of feature values');
}