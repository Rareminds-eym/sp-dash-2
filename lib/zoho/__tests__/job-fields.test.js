import { describe, it, expect, vi } from 'vitest';
import { jobCompanyField, resolveJobCompanyField, resolveBulkJobCompanyField, resolveBulkJobSchema } from '../job-fields';
import { normalizeRecruitRecord } from '../contracts';
import { parseBulkRows, prepareBulkRows, createBulkRead } from '../bulk-read';

const modificationField={api_name:'Modified_Time',field_label:'Modified Time',data_type:'datetime',custom_field:false};
const metadata = { fields: [{ field_label: 'Clients Name', api_name: 'Department_Name', data_type: 'lookup', lookup: { module: 'Clients' } }, {api_name:'Posting_Title',field_label:'Posting Title',data_type:'text'},modificationField] };
const record = { id: '123', Modified_Time: '2026-11-10T00:00:00Z', Posting_Title: 'Engineer',
  Department_Name: { name: 'Example client', id: '456' }, City: 'Chennai', Job_Type: 'Full time' };
const csv = new TextEncoder().encode('id,Modified_Time,Posting_Title,Department_Name.Client_Name,City,State,Country,Job_Type,Job_Description,Job_Opening_Status,Application_Link\n123,2026-11-10T00:00:00Z,Engineer,Example client,Chennai,Tamil Nadu,India,Full time,Description,Open,');

describe('metadata-verified Recruit company mapping', () => {
  it('uses the client label rather than interpreting the API name as a department', () => {
    const field = jobCompanyField(metadata);
    const result = normalizeRecruitRecord('Job_Openings', record, field);
    expect(result.data).toMatchObject({ company_name: 'Example client', department: '', location: 'Chennai' });
    expect(result.errors).not.toContain('department mapping is required.');
    expect(result.errors).not.toContain('company_name mapping is required.');
  });
  it.each([
    { fields: [{ field_label: 'Department', api_name: 'Department_Name', data_type: 'lookup', lookup: { module: 'Clients' } }, {api_name:'Posting_Title',field_label:'Posting Title',data_type:'text'}] },
    { fields: [...metadata.fields, { field_label: 'Client Name', api_name: 'Client_Name', data_type: 'text' }] },
    { fields: [{ ...metadata.fields[0], api_name: 'unsafe.field' }] },
    { fields: [{ ...metadata.fields[0], data_type: 'boolean' }] },
    {},
  ])('rejects unverified, ambiguous or unsafe metadata', value => {
    expect(() => jobCompanyField(value)).toThrow();
  });
  it('scopes and expires schema caching and does not cache failures', async () => {
    vi.useFakeTimers();
    try {
      const read = vi.fn(async () => metadata);
      expect(await resolveJobCompanyField('unit:source:revision:1', read)).toBe('Department_Name');
      await resolveJobCompanyField('unit:source:revision:1', read);
      expect(read).toHaveBeenCalledTimes(1);
      await resolveJobCompanyField('unit:source:revision:2', read);
      await resolveJobCompanyField('unit:other-source:revision:1', read);
      expect(read).toHaveBeenCalledTimes(3);
      vi.advanceTimersByTime(300001);
      await resolveJobCompanyField('unit:source:revision:1', read);
      expect(read).toHaveBeenCalledTimes(4);
      await expect(resolveJobCompanyField('unit:failed', async () => ({}))).rejects.toThrow();
      expect(await resolveJobCompanyField('unit:failed', read)).toBe('Department_Name');
    } finally { vi.useRealTimers(); }
  });
  it('normalizes bulk rows and indexed chunks using the same verified field', () => {
    const parsed = parseBulkRows(csv, 'Job_Openings', 0, 20, 'Department_Name.Client_Name');
    expect(parsed.records[0].data).toMatchObject({ company_name: 'Example client', department: '', location: 'Chennai' });
    expect([...prepareBulkRows(csv, 'Job_Openings', 20, 'Department_Name.Client_Name').chunks()][0].records).toEqual(parsed.records);
    expect(() => parseBulkRows(csv, 'Job_Openings')).toThrow('Export fields mismatch');
  });
  it('rejects a bare bulk lookup ID column instead of saving it as the company', () => {
    const wrong = new TextDecoder().decode(csv).replace('Department_Name.Client_Name','Department_Name').replace('Example client','29510000000123456');
    expect(() => parseBulkRows(new TextEncoder().encode(wrong),'Job_Openings',0,20,'Department_Name.Client_Name')).toThrow('Export fields mismatch');
  });
  it('resolves and caches the related client display name for bulk only', async () => {
    const read=vi.fn(async module=>module==='Job_Openings'?metadata:{fields:[{field_label:'Client Name',api_name:'Client_Name',data_type:'text'}]});
    expect(await resolveBulkJobCompanyField('unit:bulk',read)).toBe('Department_Name.Client_Name');
    await resolveBulkJobCompanyField('unit:bulk',read);expect(read).toHaveBeenCalledTimes(2);
  });
  it('uses the actual Recruit title alias and omits an absent optional application link', async () => {
    const jobMetadata={fields:[{field_label:'Clients Name',api_name:'Department_Name',data_type:'lookup',lookup:{module:'Departments'}},{field_label:'Posting Title',api_name:'Job_Opening_Name',data_type:'text'},modificationField]};
    const schema=await resolveBulkJobSchema('unit:actual-schema',async module=>module==='Job_Openings'?jobMetadata:{fields:[{field_label:'Clients Name',api_name:'Department_Name',data_type:'text'}]});
    expect(schema).toEqual({companyField:'Department_Name.Department_Name',titleField:'Job_Opening_Name',modifiedField:'Modified_Time',optionalApplicationLink:false});
    const csv=new TextEncoder().encode('id,Modified_Time,Job_Opening_Name,Department_Name.Department_Name,City,Job_Type,Job_Description,Job_Opening_Status\n123,2026-11-10T00:00:00Z,Engineer,Example client,Chennai,Full time,Description,In-progress');
    const parsed=parseBulkRows(csv,'Job_Openings',0,20,schema.companyField,schema.titleField);
    expect(parsed.records[0].data).toMatchObject({title:'Engineer',company_name:'Example client',application_link:''});
  });
  it('resumes indexed job batches without fetching metadata or downloading the export again', async () => {
    const rows = { records: [normalizeRecruitRecord('Job_Openings', record, 'Department_Name')], issues: [], total: 1, nextOffset: 1, done: true };
    const pointer = { key: 'private-test-object', digest: 'a'.repeat(64) };
    const db = { rpc: vi.fn(async name => ({ data: name === 'zoho_claim_bulk_read'
      ? { claimed: true, lease: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', run: { region: 'in', state: 'staging', module: 'Job_Openings', provider_job_id: '123', row_offset: 0, artifact: pointer, artifact_ready: true, artifact_count: 1, artifact_more: false } }
      : { done: true } })) };
    const store = { readRows: vi.fn(async () => ({ rows })), remove: vi.fn() };
    const fetcher = vi.fn();
    await createBulkRead(db, { artifactStore: store }).tick('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'token', 'in', fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith('zoho_advance_bulk_read', expect.objectContaining({ p_command: 'rows', p_payload: expect.objectContaining({ records: rows.records }) }));
  });
  it('requests the verified company field when creating a bulk export', async () => {
    const db = { rpc: vi.fn(async name => ({ data: name === 'zoho_claim_bulk_read'
      ? { claimed: true, lease: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', run: { region: 'in', state: 'creating', module: 'Job_Openings', export_page: 1 } }
      : { done: false } })) };
    const fetcher = vi.fn(async url => Response.json(url.includes('module=Clients') ? {fields:[{field_label:'Client Name',api_name:'Client_Name',data_type:'text'}]} : url.includes('/settings/fields') ? metadata : { data: [{ details: { id: '123' } }] }));
    await createBulkRead(db).tick('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'token', 'in', fetcher);
    const post = fetcher.mock.calls.find(([, init]) => init.method === 'POST');
    expect(JSON.parse(post[1].body).query.selectfields).toContain('Department_Name.Client_Name');
    expect(JSON.parse(post[1].body).query.selectfields).not.toContain('Client_Name');
    expect(JSON.parse(post[1].body).query.selectfields).not.toContain('id');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
