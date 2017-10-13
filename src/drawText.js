export default function drawText(props) {
  const selector = props.selector;
  const height = props.height;
  const xOffset = props.xOffset;
  const yOffset = props.yOffset;
  const text = props.text;
  d3
    .select(selector)
    .append('g')
    .attr('transform', `translate(${xOffset},${yOffset})`)
    .append('text')
    .style('fill', '#666')
    .style('fill-opacity', 1)
    .style('pointer-events', 'none')
    .style('stroke', 'none')
    .style('font-size', 10)
    .text(text);
}
