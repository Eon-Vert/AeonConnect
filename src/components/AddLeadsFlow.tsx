import {
  Button,
  ContentSwitcher,
  Dropdown,
  FileUploaderDropContainer,
  FileUploaderItem,
  NumberInput,
  ProgressIndicator,
  ProgressStep,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  SelectableTag,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextArea,
  TextInput,
} from '@carbon/react';
import { ArrowLeft, Download } from '@carbon/icons-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BankId, Product } from '../domain/types';
import { AD_PLATFORMS, CAMPAIGNS, CHANNELS, OFFICERS, maskPhone } from '../data/mock';
import { useStore, type NewLead } from '../state/store';
import { pipelineLink } from '../domain/pipelineQuery';

const TEMPLATE_COLS = ['customer name', 'mobile', 'email', 'company', 'salary', 'product interest', 'job title', 'LinkedIn username'];
const STEPS = ['File', 'Source', 'Preview', 'Share out', 'Confirm'];

interface Row {
  name: string;
  phone: string;
  email: string;
  employer: string;
  salary: number;
  product: Product;
  jobTitle: string;
  skip?: 'Invalid phone' | 'Already in Connect';
}

function normalisePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (/^5\d{8}$/.test(d)) return d;
  if (/^9715\d{8}$/.test(d)) return d.slice(3);
  if (/^05\d{8}$/.test(d)) return d.slice(1);
  return null;
}

function downloadTemplate() {
  const csv = `${TEMPLATE_COLS.join(',')}\nSample Customer,+971 50 000 0000,sample@mail.example,Sample Trading LLC,15000,Credit Card,Accountant,sample-customer\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aeon-connect-leads-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const MOCK_FIRST = ['Ayla', 'Basim', 'Carla', 'Dina', 'Elias', 'Fadi', 'Gina', 'Hadi', 'Ines', 'Jad', 'Kinda', 'Luay', 'Maha', 'Nabil', 'Olga', 'Rami', 'Suha', 'Tamer', 'Wael', 'Zeina'];
const MOCK_LAST = ['Aoun', 'Bazzi', 'Chidiac', 'Daher', 'Eid', 'Frem', 'Gerges', 'Hobeika', 'Issa', 'Jreij'];

function mockRows(existing: Set<string>): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < 42; i++) {
    const first = MOCK_FIRST[i % MOCK_FIRST.length];
    const last = MOCK_LAST[(i * 7) % MOCK_LAST.length];
    rows.push({
      name: `${first} ${last}`,
      phone: `5${(i % 9) + 0}${String(3000000 + i * 7919).slice(0, 7)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@mail.example`,
      employer: ['Gulf Crest Engineering', 'Palm Arc Hospitality', 'Coral Bay Telecom'][i % 3],
      salary: 9000 + ((i * 1375) % 30000),
      product: i % 3 === 0 ? 'loan' : 'card',
      jobTitle: ['Accountant', 'Nurse', 'Site Engineer', 'Teacher'][i % 4],
    });
  }
  rows[4].phone = '12345';
  rows[17].phone = '050-12';
  rows[31].phone = 'n/a';
  const dupes = [...existing].slice(0, 2);
  if (dupes[0]) rows[9].phone = dupes[0];
  if (dupes[1]) rows[25].phone = dupes[1];
  return validate(rows, existing);
}

function validate(rows: Row[], existing: Set<string>): Row[] {
  return rows.map((r) => {
    const p = normalisePhone(r.phone);
    if (!p) return { ...r, skip: 'Invalid phone' };
    if (existing.has(p)) return { ...r, phone: p, skip: 'Already in Connect' };
    return { ...r, phone: p };
  });
}

function parseCsv(text: string, existing: Set<string>): Row[] | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const col = (k: string) => head.indexOf(k);
  if (col('customer name') < 0 || col('mobile') < 0) return null;
  const rows = lines.slice(1).map((l) => {
    const v = l.split(',');
    const get = (k: string) => (col(k) >= 0 ? (v[col(k)] ?? '').trim() : '');
    return {
      name: get('customer name') || 'Unnamed lead',
      phone: get('mobile'),
      email: get('email'),
      employer: get('company'),
      salary: Number(get('salary')) || 0,
      product: (/loan|finance/i.test(get('product interest')) ? 'loan' : 'card') as Product,
      jobTitle: get('job title') || '—',
    };
  });
  return validate(rows, existing);
}

export function AddLeadsFlow({ onBack, defaultBank = 'MAWARID' }: { onBack: () => void; defaultBank?: BankId }) {
  const [mode, setMode] = useState<0 | 1>(0);
  return (
    <div className="upload-flow">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>Add Leads</h1>
      <ContentSwitcher selectedIndex={mode} onChange={({ index }: { index?: number }) => setMode((index ?? 0) as 0 | 1)} size="md" style={{ maxWidth: '24rem' }}>
        <Switch name="bulk" text="Bulk file" />
        <Switch name="single" text="Single lead" />
      </ContentSwitcher>
      {mode === 0 ? <BulkFlow defaultBank={defaultBank} /> : <SingleLead defaultBank={defaultBank} />}
    </div>
  );
}

/* ----------------------------------------------------------------- bulk */
function BulkFlow({ defaultBank }: { defaultBank: BankId }) {
  const cases = useStore((s) => s.cases);
  const addLeads = useStore((s) => s.addLeads);
  const showToast = useStore((s) => s.showToast);
  const navigate = useNavigate();
  const existing = useMemo(() => new Set(cases.map((c) => c.phone)), [cases]);

  const [step, setStep] = useState(0);
  const [bank, setBank] = useState<BankId>(defaultBank);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [campaign, setCampaign] = useState('');
  const [channel, setChannel] = useState('');
  const [platform, setPlatform] = useState('');
  const [officers, setOfficers] = useState<string[]>([]);
  const [share, setShare] = useState<'even' | 'release'>('even');
  const [perDay, setPerDay] = useState(25);

  const good = rows.filter((r) => !r.skip);
  const skipped = rows.length - good.length;
  const perOfficer = officers.length ? Math.ceil(good.length / officers.length) : 0;
  const days = officers.length ? Math.ceil(good.length / (officers.length * Math.max(1, perDay))) : 0;

  const canNext = [!!file && rows.length > 0, !!(campaign && channel && platform), good.length > 0, officers.length > 0 && (share === 'even' || perDay > 0), true][step];

  async function onFile(f: File) {
    setFile(f);
    let parsed: Row[] | null = null;
    if (/\.csv$/i.test(f.name)) parsed = parseCsv(await f.text(), existing);
    setRows(parsed ?? mockRows(existing));
  }

  function apply() {
    const leads: NewLead[] = good.map((r, i) => ({ ...r, officerId: officers[i % officers.length] }));
    const n = addLeads(bank, leads, { campaign, channel, platform, skipped });
    showToast({ kind: 'success', title: `${n} leads added`, subtitle: `${campaign} · ${channel} · ${platform}` });
    navigate(pipelineLink({ bank, company: true, bucket: 'with_officer', sort: 'captured', date: 'today' }));
  }

  const ddSel = (id: string, label: string, items: string[], value: string, set: (v: string) => void) => (
    <Dropdown id={id} titleText={`${label} (required)`} label={`Choose ${label.toLowerCase()}`} items={items} selectedItem={value || null} onChange={({ selectedItem }) => set(selectedItem ?? '')} />
  );

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <ProgressIndicator currentIndex={step} spaceEqually>
        {STEPS.map((s) => (
          <ProgressStep key={s} label={s} />
        ))}
      </ProgressIndicator>

      <div className="step-body">
        {step === 0 && (
          <>
            <div style={{ maxWidth: '20rem' }}>
              <Select id="bulk-bank" labelText="Bank team" value={bank} onChange={(e) => setBank(e.target.value as BankId)}>
                <SelectItem value="MAWARID" text="Mawarid" />
                <SelectItem value="DIB" text="DIB" />
              </Select>
            </div>
            <div>
              <p className="cds--label">Lead file</p>
              <p className="helper-line">CSV or Excel, one lead per row. Columns: {TEMPLATE_COLS.join(', ')}.</p>
              {!file ? (
                <FileUploaderDropContainer
                  labelText="Drag and drop a CSV or Excel file here, or click to choose"
                  accept={['.csv', '.xlsx', '.xls']}
                  onAddFiles={(_e: unknown, { addedFiles }: { addedFiles: File[] }) => addedFiles[0] && onFile(addedFiles[0])}
                />
              ) : (
                <FileUploaderItem
                  name={file.name}
                  status="edit"
                  iconDescription="Remove file"
                  onDelete={() => {
                    setFile(null);
                    setRows([]);
                  }}
                />
              )}
              {file && <p className="helper-line mt-05">{rows.length} rows read. Nothing is saved yet.</p>}
            </div>
            <div>
              <Button kind="ghost" size="sm" renderIcon={Download} onClick={downloadTemplate}>
                Download template
              </Button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="helper-line">Applies to every lead in this file.</p>
            <div className="form-grid">
              {ddSel('campaign', 'Campaign', CAMPAIGNS, campaign, setCampaign)}
              {ddSel('channel', 'Channel', CHANNELS, channel, setChannel)}
              {ddSel('platform', 'Ad platform', AD_PLATFORMS, platform, setPlatform)}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p>
              <strong>{good.length} leads</strong> will be added. <strong>{skipped}</strong> rows are skipped. Nothing is saved yet.
            </p>
            <div className="case-table-wrap" style={{ maxHeight: '26rem', overflowY: 'auto' }}>
              <Table size="sm" aria-label="Preview of uploaded rows">
                <TableHead>
                  <TableRow>
                    <TableHeader>Row</TableHeader>
                    <TableHeader>Customer</TableHeader>
                    <TableHeader>Mobile</TableHeader>
                    <TableHeader>Company</TableHeader>
                    <TableHeader>Product</TableHeader>
                    <TableHeader>Status</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 2}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.skip === 'Invalid phone' ? r.phone || '(blank)' : maskPhone(r.phone)}</TableCell>
                      <TableCell>{r.employer || '—'}</TableCell>
                      <TableCell>{r.product === 'card' ? 'Card' : 'Personal finance'}</TableCell>
                      <TableCell>{r.skip ? <span className="skip-flag">Skipped · {r.skip}</span> : 'Ready'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <p className="cds--label">Officers (pick one or more)</p>
              <div className="officer-chips">
                {OFFICERS.map((o) => (
                  <SelectableTag
                    key={o.id}
                    text={`${o.id} · ${o.team}`}
                    selected={officers.includes(o.id)}
                    onChange={(sel: boolean) => setOfficers((x) => (sel ? [...x, o.id] : x.filter((y) => y !== o.id)))}
                  />
                ))}
              </div>
            </div>
            <RadioButtonGroup legendText="How to share" name="share" valueSelected={share} onChange={(v) => setShare(v as 'even' | 'release')} orientation="vertical">
              <RadioButton id="share-even" value="even" labelText="Share out evenly" />
              <RadioButton id="share-release" value="release" labelText="Release over several days" />
            </RadioButtonGroup>
            {share === 'release' && (
              <NumberInput id="per-day" label="Leads per officer per day" min={1} max={200} value={perDay} onChange={(_e: unknown, { value }: { value: number | string }) => setPerDay(Number(value))} style={{ maxWidth: '12rem' }} />
            )}
            {officers.length > 0 && (
              <p className="helper-line">
                {share === 'even' ? `About ${perOfficer} leads per officer, all today.` : `${perDay} per officer per day: released over ${days} ${days === 1 ? 'day' : 'days'}.`}
              </p>
            )}
          </>
        )}

        {step === 4 && (
          <div className="summary">
            <dl>
              <dt>Bank team</dt>
              <dd>{bank === 'MAWARID' ? 'Mawarid' : 'DIB'}</dd>
              <dt>File</dt>
              <dd>{file?.name}</dd>
              <dt>Leads to add</dt>
              <dd>{good.length}</dd>
              <dt>Skipped at upload</dt>
              <dd>{skipped}</dd>
              <dt>Source</dt>
              <dd>
                {campaign} · {channel} · {platform}
              </dd>
              <dt>Officers</dt>
              <dd>{officers.join(', ')}</dd>
              <dt>Share out</dt>
              <dd>{share === 'even' ? `Evenly, about ${perOfficer} each` : `${perDay} per officer per day over ${days} days`}</dd>
            </dl>
            <p className="helper-line mt-05">New leads appear in Pipeline at To contact with the Company tag.</p>
          </div>
        )}
      </div>

      <div className="step-actions">
        {step > 0 && (
          <Button kind="secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {step < 4 ? (
          <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Next: {STEPS[step + 1]}
          </Button>
        ) : (
          <Button onClick={apply}>Apply</Button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- single */
function SingleLead({ defaultBank }: { defaultBank: BankId }) {
  const addSingleLead = useStore((s) => s.addSingleLead);
  const showToast = useStore((s) => s.showToast);
  const navigate = useNavigate();
  const [f, setF] = useState({ bank: defaultBank, name: '', mobile: '', email: '', product: 'card' as Product, salary: '', officer: '', note: '' });
  const [touched, setTouched] = useState(false);
  const phone = normalisePhone(f.mobile);
  const errors = {
    name: !f.name.trim() ? 'Enter the customer name' : '',
    mobile: !phone ? 'Enter a UAE mobile, for example 050 123 4567' : '',
    officer: !f.officer ? 'Choose who the lead is assigned to' : '',
  };
  const valid = !errors.name && !errors.mobile && !errors.officer;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  function save() {
    setTouched(true);
    if (!valid) return;
    const id = addSingleLead(f.bank, {
      name: f.name.trim(),
      phone: phone!,
      email: f.email.trim(),
      employer: '—',
      salary: Number(f.salary) || 0,
      product: f.product,
      officerId: f.officer,
      note: f.note.trim() || undefined,
    });
    showToast({ kind: 'success', title: '1 lead added', subtitle: `Case ${id} · assigned to ${f.officer}` });
    navigate(pipelineLink({ bank: f.bank, sort: 'captured', date: 'today' }));
  }

  return (
    <div className="step-body">
      <div className="form-grid">
        <Select id="s-bank" labelText="Bank team" value={f.bank} onChange={set('bank')}>
          <SelectItem value="MAWARID" text="Mawarid" />
          <SelectItem value="DIB" text="DIB" />
        </Select>
        <TextInput id="s-name" labelText="Customer name (required)" value={f.name} onChange={set('name')} invalid={touched && !!errors.name} invalidText={errors.name} />
        <TextInput id="s-mobile" labelText="Mobile (required)" placeholder="050 123 4567" value={f.mobile} onChange={set('mobile')} invalid={touched && !!errors.mobile} invalidText={errors.mobile} />
        <TextInput id="s-email" labelText="Email" value={f.email} onChange={set('email')} />
        <Select id="s-product" labelText="Product" value={f.product} onChange={set('product')}>
          <SelectItem value="card" text="Credit Card" />
          <SelectItem value="loan" text="Personal loan" />
        </Select>
        <TextInput id="s-salary" labelText="Salary (AED / month)" inputMode="numeric" value={f.salary} onChange={set('salary')} />
        <Select id="s-officer" labelText="Assign to (required)" value={f.officer} onChange={set('officer')} invalid={touched && !!errors.officer} invalidText={errors.officer}>
          <SelectItem value="" text="Choose an officer" />
          {OFFICERS.map((o) => (
            <SelectItem key={o.id} value={o.id} text={`${o.id} · ${o.name} · ${o.team}`} />
          ))}
        </Select>
      </div>
      <TextArea id="s-note" labelText="Note (optional)" rows={2} value={f.note} onChange={set('note')} />
      <div className="step-actions" style={{ marginTop: 0 }}>
        <Button onClick={save}>Save</Button>
      </div>
    </div>
  );
}
