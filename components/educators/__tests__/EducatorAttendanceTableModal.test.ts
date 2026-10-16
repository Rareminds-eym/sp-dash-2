import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {AttendanceRecordsTable} from '../EducatorAttendanceTableModal';
it('renders recorded attendance and preserves previous trainer identity',()=>{
 const html=renderToStaticMarkup(React.createElement(AttendanceRecordsTable,{rows:[{id:'attendance',date:'2026-10-16',organization_staff_id:'original',staff:{first_name:'Hari',last_name:'PN',employee_id:'FAC1'},session:{subject_name:'Python',start_time:'09:00:00',end_time:'10:00:00',organization_staff_id:'replacement'},organization:{name:'Soundarya'},status:'absent',remarks:'Approved leave',marked_at:'2026-10-16T04:00:00Z'}]}));
 for(const text of ['Hari PN','Previous trainer','Python','09:00 - 10:00','absent','Approved leave','Soundarya'])expect(html).toContain(text);
});
it('supports daily attendance records without class sessions',()=>{
 const html=renderToStaticMarkup(React.createElement(AttendanceRecordsTable,{rows:[{id:'daily',staff:{first_name:'Trainer'},status:'present',session:null}]}));
 expect(html).toContain('Daily attendance');expect(html).not.toContain('Previous trainer');
});
it('shows a clear empty state',()=>{expect(renderToStaticMarkup(React.createElement(AttendanceRecordsTable,{rows:[]}))).toContain('No recorded attendance matches these filters.');});
