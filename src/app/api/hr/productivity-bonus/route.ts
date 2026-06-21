import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { calculateTicketFinances } from "@/lib/calculations";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

const supabase = createClient(
  getSupabaseUrl(),
  getSupabaseAnonKey()
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // Standard: 1-12
  const year = searchParams.get("year");

  if (!month || !year) {
    return NextResponse.json({ error: "Month and Year are required" }, { status: 400 });
  }

  const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
  const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();

  try {
    // 1. Fetch closed tickets in range
    const { data: closedTickets, error: tError } = await supabase
      .from("tickets")
      .select("*, gestoras(*), costos:ticket_costs(*)")
      .gte("closure_date", startOfMonth)
      .lte("closure_date", endOfMonth);

    if (tError) throw tError;

    // 2. Fetch targets for that month
    const monthKey = `${year}-${month.padStart(2, '0')}`;
    const { data: targets, error: tgError } = await supabase
      .from("gestor_goals")
      .select("*")
      .eq("month_key", monthKey);

    if (tgError) throw tgError;

    // 3. Fetch all gestoras mentioned or registered
    const { data: gestoras, error: gError } = await supabase
      .from("gestoras")
      .select("*");

    if (gError) throw gError;

    // 4. Calculate Productivity
    const report = gestoras.map(g => {
      const myTickets = closedTickets?.filter(t => t.gestora_id === g.id) || [];
      const target = targets?.find(tg => tg.gestora_id === g.id);

      const utilityTotal = myTickets.reduce((acc, t) => {
        return acc + calculateTicketFinances(t, t.costos || []).realProfitability;
      }, 0);

      const targetAmount = target?.target_amount || 35000;
      const multiplier = target?.bonus_multiplier || 0.1;
      const baseLaboral = parseFloat(g.costo_laboral_mensual || 0);

      const percentAchieved = (utilityTotal / targetAmount) * 100;
      const bonusEarned = percentAchieved >= 80 ? (utilityTotal / targetAmount) * (baseLaboral * multiplier) : 0;

      return {
        gestora: g.name,
        achievedUtility: utilityTotal,
        ticketsCount: myTickets.length,
        percentMeta: percentAchieved,
        bonus: bonusEarned
      };
    });

    return NextResponse.json({
        period: monthKey,
        totalUtility: report.reduce((s, r) => s + r.achievedUtility, 0),
        totalBonuses: report.reduce((s, r) => s + r.bonus, 0),
        details: report
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
