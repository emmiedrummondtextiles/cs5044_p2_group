export function drawPieChart(data) {
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // 将 'NA' 替换为 'Unknown'，同时将 '0' 改为 'Others'，'1' 改为 'English' 在 Song_In_English 列
  data = data.map(d => ({
    ...d,
    'Song_In_English': d['Song_In_English'] === 'NA' ? 'Unknown' : 
                        d['Song_In_English'] === 0 ? 'Others' : 
                        d['Song_In_English'] === 1 ? 'English' : d['Song_In_English']
  }));

  // 获取 Song_In_English 列的所有独特值
  const songInEnglishCounts = d3.rollups(
    data,
    v => v.length,
    d => d['Song_In_English']
  ).sort((a, b) => d3.descending(a[1], b[1]));

  // 清空旧图表
  d3.select('#pieChart').selectAll('*').remove();

  const svg = d3.select('#pieChart')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${width / 2 + margin.left}, ${height / 2 + margin.top})`);

  const radius = Math.min(width, height) / 2;

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // 定义饼图生成器
  const pie = d3.pie()
    .value(d => d[1]);

  // 定义弧生成器
  const arc = d3.arc()
    .outerRadius(radius - 10)
    .innerRadius(0);

  // 创建饼图的每一部分
  const arcs = svg.selectAll('.arc')
    .data(pie(songInEnglishCounts))  
    .enter()
    .append('g')
    .attr('class', 'arc');

  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => colorScale(d.data[0]))  // 使用正确的颜色映射
    .attr('stroke', 'white')  // 添加白色边框来分隔扇形
    .attr('stroke-width', 1);

  // 在每个扇形上添加分类标签
  arcs.append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)  // 将标签放置到扇形的中心
    .attr('dy', '.35em')
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .text(d => d.data[0]);  // 显示每个部分的标签（English 或 Others）

  // 创建一个 Tooltip 元素
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

  // 添加鼠标事件：mouseover 和 mouseout
  arcs.on('mouseover', function(event, d) {
    tooltip
      .style('visibility', 'visible')
      .html(`${d.data[0]}: ${d.data[1]} items`);  // 显示类别和数量
  })
  .on('mousemove', function(event) {
    tooltip
      .style('top', `${event.pageY + 10}px`)  // 调整 tooltip 的位置
      .style('left', `${event.pageX + 10}px`);
  })
  .on('mouseout', function() {
    tooltip.style('visibility', 'hidden');  // 隐藏 tooltip
  });

  // 添加标题
  svg.append('text')
    .attr('x', 0)
    .attr('y', -radius - 10)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px')
    .text('Song In English Distribution');

  // 获取年份字段中的独特值并生成筛选器选项
  const years = Array.from(new Set(data.map(d => d['Year'])))
    .sort((a, b) => a - b);  // 对年份进行排序

  // 添加年份筛选器
  const yearFilter = d3.select('#yearFilter');
  const yearSelect = yearFilter.append('select')
    .attr('id', 'yearSelect')
    .on('change', function() {
      const selectedYear = this.value;
      console.log('Selected Year:', selectedYear);
      // 根据选中的年份更新数据，重新绘制饼图
      updatePieChartForYear(selectedYear);
    });

  // 添加 "All" 选项
  yearSelect.append('option')
    .attr('value', 'All')
    .text('All');

  // 填充年份选择项
  yearSelect.selectAll('option')
    .data(years)
    .enter()
    .append('option')
    .attr('value', d => d)
    .text(d => d);

  // 更新饼图的函数
  function updatePieChartForYear(year) {
    // 过滤数据（如果选择了 "All"，则不进行过滤）
    let filteredData = year === 'All' ? data : data.filter(d => d['Year'] === +year);  


    // 重新计算 Song_In_English 列的计数
    const updatedSongInEnglishCounts = d3.rollups(
      filteredData,
      v => v.length,
      d => d['Song_In_English']
    ).sort((a, b) => d3.descending(a[1], b[1]));

    // 清空旧图表
    svg.selectAll('.arc').remove();

    // 创建新的饼图部分
    const newArcs = svg.selectAll('.arc')
      .data(pie(updatedSongInEnglishCounts))  // 使用更新后的数据
      .enter()
      .append('g')
      .attr('class', 'arc');

    newArcs.append('path')
      .attr('d', arc)
      .attr('fill', d => colorScale(d.data[0]))  // 使用正确的颜色映射
      .attr('stroke', 'white')  // 添加白色边框来分隔扇形
      .attr('stroke-width', 1);

    // 在每个扇形上添加分类标签
    newArcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)  // 将标签放置到扇形的中心
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(d => d.data[0]);  // 显示每个部分的标签（English 或 Others）

    // 重新绑定鼠标事件，确保 tooltip 正常显示
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
