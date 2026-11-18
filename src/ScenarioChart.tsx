import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatGBP } from "./model";

export default function ScenarioChart({ data }: { data: Array<{ name: string; balance: number }> }) {
  return <ResponsiveContainer width="100%" height={280}>
    <BarChart data={data} margin={{top:8,right:12,left:0,bottom:45}}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e6edef" vertical={false}/>
      <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={60} tick={{fontSize:11}}/>
      <YAxis tickFormatter={(v)=>`£${Math.round(v/1000)}k`} tick={{fontSize:11}}/>
      <Tooltip formatter={(value)=>[formatGBP(Number(value)),"Balance"]}/>
      <Bar dataKey="balance" fill="#183e49" radius={[6,6,0,0]}/>
    </BarChart>
  </ResponsiveContainer>;
}
