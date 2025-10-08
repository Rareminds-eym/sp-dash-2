// Seed script for recruiter tracking and analytics data
import { supabase } from '../lib/supabase.js'
import { v4 as uuidv4 } from 'uuid'

async function seedRecruiterData() {
  try {
    console.log('Starting recruiter data seeding...')

    // Get existing organizations and users
    const { data: organizations } = await supabase.from('organizations').select('*')
    const { data: users } = await supabase.from('users').select('*')
    const { data: students } = await supabase.from('students').select('*')

    if (!organizations || !users || !students) {
      console.error('Missing base data. Run basic setup first.')
      return
    }

    // 1. Create recruiter organizations
    const recruiterOrgs = [
      { id: uuidv4(), name: 'TechCorp Solutions', type: 'recruiter', state: 'Karnataka', district: 'Bangalore Urban' },
      { id: uuidv4(), name: 'InnovateTech Ltd', type: 'recruiter', state: 'Maharashtra', district: 'Mumbai' },
      { id: uuidv4(), name: 'FutureSkills Inc', type: 'recruiter', state: 'Tamil Nadu', district: 'Chennai' },
      { id: uuidv4(), name: 'GlobalTech Partners', type: 'recruiter', state: 'Telangana', district: 'Hyderabad' },
      { id: uuidv4(), name: 'DataDriven Systems', type: 'recruiter', state: 'Delhi', district: 'New Delhi' }
    ]

    console.log('Creating recruiter organizations...')
    const { data: createdOrgs, error: orgError } = await supabase
      .from('organizations')
      .upsert(recruiterOrgs, { onConflict: 'id' })
      .select()

    if (orgError) {
      console.error('Error creating organizations:', orgError)
      return
    }

    // 2. Create recruiter users
    const recruiterUsers = [
      { id: uuidv4(), email: 'recruiter1@techcorp.com', role: 'manager', organizationId: recruiterOrgs[0].id, isActive: true },
      { id: uuidv4(), email: 'recruiter2@innovatetech.com', role: 'manager', organizationId: recruiterOrgs[1].id, isActive: true },
      { id: uuidv4(), email: 'recruiter3@futureskills.com', role: 'manager', organizationId: recruiterOrgs[2].id, isActive: true },
      { id: uuidv4(), email: 'recruiter4@globaltech.com', role: 'manager', organizationId: recruiterOrgs[3].id, isActive: true },
      { id: uuidv4(), email: 'recruiter5@datadriven.com', role: 'manager', organizationId: recruiterOrgs[4].id, isActive: true }
    ]

    console.log('Creating recruiter users...')
    const { data: createdUsers, error: userError } = await supabase
      .from('users')
      .upsert(recruiterUsers, { onConflict: 'email' })
      .select()

    if (userError) {
      console.error('Error creating users:', userError)
      return
    }

    // 3. Create recruiters
    const recruiters = recruiterOrgs.map((org, index) => ({
      id: uuidv4(),
      organizationId: org.id,
      userId: recruiterUsers[index].id,
      companyName: org.name,
      industry: ['Technology', 'Software', 'IT Services', 'Consulting', 'Data Analytics'][index],
      location: org.state,
      isActive: true,
      metadata: {
        companySize: ['100-500', '500-1000', '50-100', '1000+', '200-500'][index],
        focusAreas: [
          ['Web Development', 'Mobile Apps'],
          ['AI/ML', 'Data Science'],
          ['Cloud Computing', 'DevOps'],
          ['Blockchain', 'Cybersecurity'],
          ['Analytics', 'Big Data']
        ][index]
      }
    }))

    console.log('Creating recruiters...')
    const { data: createdRecruiters, error: recruiterError } = await supabase
      .from('recruiters')
      .upsert(recruiters, { onConflict: 'id' })
      .select()

    if (recruiterError) {
      console.error('Error creating recruiters:', recruiterError)
      return
    }

    // 4. Create recruiter activities (searches, views, etc.)
    const activities = []
    const activityTypes = ['search', 'profile_view', 'contact', 'shortlist', 'hire_intent']
    
    for (let i = 0; i < 100; i++) {
      const recruiterId = recruiters[Math.floor(Math.random() * recruiters.length)].id
      const studentId = students[Math.floor(Math.random() * students.length)]?.id
      const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)]
      
      const createdDate = new Date()
      createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 30))

      activities.push({
        id: uuidv4(),
        recruiterId,
        activityType,
        targetStudentId: studentId,
        searchCriteria: activityType === 'search' ? {
          skills: ['JavaScript', 'Python', 'React', 'Node.js', 'AI/ML'][Math.floor(Math.random() * 5)],
          experience: Math.floor(Math.random() * 5) + 1,
          location: ['Bangalore', 'Mumbai', 'Chennai', 'Hyderabad', 'Delhi'][Math.floor(Math.random() * 5)]
        } : {},
        metadata: {
          duration: Math.floor(Math.random() * 300) + 30, // 30-330 seconds
          deviceType: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)]
        },
        createdAt: createdDate.toISOString()
      })
    }

    console.log('Creating recruiter activities...')
    const { error: activitiesError } = await supabase
      .from('recruiter_activities')
      .upsert(activities, { onConflict: 'id' })

    if (activitiesError) {
      console.error('Error creating activities:', activitiesError)
      return
    }

    // 5. Create placements data
    const placements = []
    const jobTitles = [
      'Software Engineer', 'Full Stack Developer', 'Data Scientist', 'DevOps Engineer',
      'Frontend Developer', 'Backend Developer', 'AI/ML Engineer', 'Product Manager',
      'UI/UX Designer', 'Cloud Architect', 'Cybersecurity Analyst', 'Business Analyst'
    ]
    const statuses = ['applied', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'retained_6m', 'retained_1y']

    for (let i = 0; i < 50; i++) {
      const recruiterId = recruiters[Math.floor(Math.random() * recruiters.length)].id
      const studentId = students[Math.floor(Math.random() * students.length)]?.id
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      
      const appliedDate = new Date()
      appliedDate.setDate(appliedDate.getDate() - Math.floor(Math.random() * 60))
      
      const hiredDate = ['hired', 'retained_6m', 'retained_1y'].includes(status) ? 
        new Date(appliedDate.getTime() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000) : null

      placements.push({
        id: uuidv4(),
        studentId,
        recruiterId,
        jobTitle: jobTitles[Math.floor(Math.random() * jobTitles.length)],
        salaryOffered: Math.floor(Math.random() * 800000) + 300000, // 3L - 11L
        placementStatus: status,
        appliedDate: appliedDate.toISOString(),
        hiredDate: hiredDate?.toISOString(),
        retentionDate: status === 'retained_1y' ? new Date(hiredDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
        metadata: {
          interviewRounds: Math.floor(Math.random() * 4) + 1,
          offerType: ['full-time', 'contract', 'internship'][Math.floor(Math.random() * 3)]
        }
      })
    }

    console.log('Creating placements...')
    const { error: placementsError } = await supabase
      .from('placements')
      .upsert(placements, { onConflict: 'id' })

    if (placementsError) {
      console.error('Error creating placements:', placementsError)
      return
    }

    // 6. Create skill trends data
    const skills = [
      { name: 'React.js', category: 'Frontend' },
      { name: 'Node.js', category: 'Backend' },
      { name: 'Python', category: 'Programming' },
      { name: 'Machine Learning', category: 'AI/ML' },
      { name: 'Docker', category: 'DevOps' },
      { name: 'Kubernetes', category: 'DevOps' },
      { name: 'AWS', category: 'Cloud' },
      { name: 'MongoDB', category: 'Database' },
      { name: 'TypeScript', category: 'Programming' },
      { name: 'Vue.js', category: 'Frontend' },
      { name: 'GraphQL', category: 'API' },
      { name: 'Blockchain', category: 'Emerging' }
    ]

    const skillTrends = skills.map(skill => ({
      id: uuidv4(),
      skillName: skill.name,
      category: skill.category,
      demandScore: Math.floor(Math.random() * 100) + 1,
      trendDirection: ['rising', 'stable', 'declining'][Math.floor(Math.random() * 3)],
      weeklyGrowth: (Math.random() * 20 - 10).toFixed(2), // -10% to +10%
      monthlyGrowth: (Math.random() * 50 - 25).toFixed(2), // -25% to +25%
      snapshotDate: new Date().toISOString().split('T')[0]
    }))

    console.log('Creating skill trends...')
    const { error: skillsError } = await supabase
      .from('skill_trends')
      .upsert(skillTrends, { onConflict: 'id' })

    if (skillsError) {
      console.error('Error creating skill trends:', skillsError)
      return
    }

    // 7. Create university performance data
    const universities = organizations.filter(org => org.type === 'university')
    const universityPerformance = universities.map((uni, index) => ({
      id: uuidv4(),
      universityId: uni.id,
      enrollmentCount: Math.floor(Math.random() * 5000) + 500,
      completionRate: (Math.random() * 40 + 60).toFixed(2), // 60-100%
      verificationRate: (Math.random() * 30 + 70).toFixed(2), // 70-100%
      placementRate: (Math.random() * 50 + 50).toFixed(2), // 50-100%
      avgSalary: Math.floor(Math.random() * 500000) + 400000, // 4L - 9L
      performanceScore: (Math.random() * 20 + 80).toFixed(2), // 80-100
      rankPosition: index + 1,
      snapshotDate: new Date().toISOString().split('T')[0]
    }))

    console.log('Creating university performance data...')
    const { error: perfError } = await supabase
      .from('university_performance')
      .upsert(universityPerformance, { onConflict: 'id' })

    if (perfError) {
      console.error('Error creating university performance:', perfError)
      return
    }

    console.log('✅ Recruiter data seeding completed successfully!')
    console.log(`Created:
    - ${recruiterOrgs.length} recruiter organizations
    - ${recruiterUsers.length} recruiter users
    - ${recruiters.length} recruiter profiles
    - ${activities.length} recruiter activities
    - ${placements.length} placement records
    - ${skillTrends.length} skill trend entries
    - ${universityPerformance.length} university performance records`)

  } catch (error) {
    console.error('Error seeding recruiter data:', error)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedRecruiterData()
}

export default seedRecruiterData