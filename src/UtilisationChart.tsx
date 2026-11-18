import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function UtilisationChart({ data }: { data: Array<{ name: string; utilisation: number }> }) {
  return <>
  <ResponsiveContainer width="100%" height={300}>
    <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 12, left: 0, bottom: 42 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e6edef" vertical={false}/>
      <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={65} tick={{fontSize:11}}/>
      <YAxis unit="%" domain={[0, (maximum: number) => Math.max(100, maximum)]} tick={{fontSize:11}}/>
      <Tooltip formatter={(value)=>[`${value}%`, "Utilisation"]}/>
      <Bar dataKey="utilisation" fill="#20a879" radius={[6,6,0,0]} isAnimationActive={false}/>
      <ReferenceLine y={50} stroke="#b56c14" strokeWidth={2} strokeDasharray="5 4" />
    </BarChart>
  </ResponsiveContainer>
  <details>
    <summary>View utilisation chart data</summary>
    <table>
      <thead><tr><th scope="col">Card</th><th scope="col">Utilisation</th><th scope="col">50% target</th></tr></thead>
      <tbody>{data.map((card, index) => (
        <tr key={index}>
          <th scope="row">{card.name}</th>
          <td>{card.utilisation.toFixed(2)}%</td>
          <td>{card.utilisation > 50 ? "Above target" : "At or below target"}</td>
        </tr>
      ))}</tbody>
    </table>
  </details>
  </>;
}
