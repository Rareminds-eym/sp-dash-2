import {it,expect} from 'vitest';
import {bulkStagingWindow} from '../bulk-staging-window';
it('resumes every bounded job window without losing records or validation issues',()=>{
 const records=Array.from({length:17},(_,id)=>({id})),issues=Array.from({length:3},(_,id)=>({issue:id}));
 const rows={records,issues,total:20,nextOffset:20,done:true};
 const windows=[0,5,10,15].map(offset=>bulkStagingWindow(rows,offset,5));
 expect(windows.flatMap(x=>x.records)).toEqual(records);
 expect(windows.flatMap(x=>x.issues)).toEqual(issues);
 expect(windows.map(x=>x.nextOffset)).toEqual([5,10,15,20]);
 expect(windows.map(x=>x.done)).toEqual([false,false,false,true]);
 expect(()=>bulkStagingWindow(rows,21,5)).toThrow('cursor');
});
it('retains final partial-chunk offsets',()=>{
 const rows={records:[{id:20},{id:21}],issues:[],total:22,nextOffset:22,done:true};
 expect(bulkStagingWindow(rows,20,5)).toEqual(rows);
});
