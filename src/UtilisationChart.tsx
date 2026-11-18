import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function UtilisationChart({ data }: { data: Array<{ name: string; utilisation: number }> }) {
  return <ResponsiveContainer width="100%" height={300}>
    <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 42 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e6edef" vertical={false}/>
      <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={65} tick={{fontSize:11}}/>
      <YAxis unit="%" tick={{fontSize:11}}/>
      <Tooltip formatter={(value)=>[`${value}%`, "Utilisation"]}/>
      <Bar dataKey="utilisation" fill="#20a879" radius={[6,6,0,0]}/>
    </BarChart>
  </ResponsiveContainer>;
}
