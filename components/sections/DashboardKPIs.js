'use client'

import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowDown,
  ArrowUp,
  Award,
  Building2,
  GraduationCap,
  TrendingUp,
  Users,
  Briefcase
} from 'lucide-react'

export function DashboardKPIs({ metrics, placementData }) {
  // Extract job secured count from placement data
  const jobSecuredCount = placementData?.conversionFunnel?.find(item => item.stage === 'Hired')?.count || 0;
  
  const kpiCards = [
    {
      title: 'Active Recruiters',
      value: metrics?.activeRecruiters || 0,
      icon: Building2,
      color: 'bg-campaign-blue1',
      change: '+10%',
      trend: 'up',
    },
    {
      title: 'Universities',
      value: metrics?.activeUniversities || 0,
      icon: GraduationCap,
      color: 'bg-campaign-blue1',
      change: '+12%',
      trend: 'up',
    },
    {
      title: 'Students',
      value: metrics?.registeredStudents || 0,
      icon: Users,
      color: 'bg-campaign-blue1',
      change: '+18%',
      trend: 'up',
    },
    {
      title: 'Verified Passports',
      value: metrics?.verifiedPassports || 0,
      icon: Award,
      color: 'bg-campaign-blue1',
      change: '+8%',
      trend: 'up',
    },
    {
      title: 'Employability Index',
      value: `${parseFloat(metrics?.employabilityIndex || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'bg-campaign-blue1',
      change: '+3%',
      trend: 'up',
    },
    {
      title: 'Job Secured',
      value: jobSecuredCount,
      icon: Briefcase,
      color: 'bg-campaign-blue1',
      change: '+5%',
      trend: 'up',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {kpiCards.map((card, index) => {
        const Icon = card.icon
        return (
          <Card key={index} className="neu-card group overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div
                  className={`${card.color} p-4 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <div
                  className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full ${
                    card.trend === 'up'
                      ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                      : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                  }`}
                >
                  {card.trend === 'up' ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                  {card.change}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2 font-medium">
                  {card.title}
                </p>
                <p className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300 origin-left">
                  {card.value}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}