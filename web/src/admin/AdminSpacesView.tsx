import { useState, type ReactNode } from 'react';
import { Building2, ChevronDown, ChevronUp, Minus, UserX } from 'lucide-react';
import {
  ADMIN_NO_SPACE,
  adminAlsoInLabel,
  adminDevicesLabel,
  adminJoinedLabel,
  adminLastSeenLabel,
  adminNoSpaceLine,
  adminSpaceLine,
  adminSpacesRange,
  adminUsersRange,
  type AdminSpaceMember,
  type AdminSpaceMembersPage,
  type AdminSpaceSummary,
  type AdminSpacesOverview,
} from '@lilachat/shared';
import { RolePill } from '../spaces/memberWeb';
import { SpaceLogo } from '../spaces/SpaceLogo';
import { Cell, Dash, EmailValue, EmptyNote, ErrorNote, KICKER, Pager, PersonCell, SkeletonRows, lastPage } from './AdminParts';
import type { AdminLoad } from './useAdminLoad';

/**
 * The superadmin's panel grouped by space (José 14/11, design
 * `adm-01-usuarios-por-espacio`): a filter of spaces (a column from `lg`, a
 * row of chips that scrolls on its own below), one card per space with its
 * first members and «Sin espacio». Choosing a space lists all its members,
 * 50 per page. Desktop-first; below `md` each person is a card.
 */
const MEMBER_COLUMNS = 'md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,0.9fr)_minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)] md:items-center md:gap-3';
const CARD = 'md:overflow-hidden md:rounded-xl md:border md:border-outline/15 md:bg-surface';
const NOBODY_ACTIVE = 'Este espacio no tiene miembros activos.';
const PILL = 'rounded-md border px-1.5 text-[10px] font-bold uppercase leading-5';

type Props = {
  overview: AdminLoad<AdminSpacesOverview>;
  members: AdminLoad<AdminSpaceMembersPage> | null;
  space: string | null;
  onSpace: (space: string | null) => void;
  onPage: (page: number) => void;
  onRetry: () => void;
  /** A search is on: an empty list then means «nobody matches», not «nobody here». */
  searched: boolean;
};

export function AdminSpacesView(props: Props) {
  const ready = props.overview.status === 'ready' ? props.overview.data : null;
  // Lives above the loading switch: a search or a page reload unmounts the cards (review of adm-01).
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  return (
    <div className="mt-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <SpaceFilter overview={ready} space={props.space} onSpace={props.onSpace} />
      <div className="min-w-0 space-y-6 max-lg:mt-4">
        <SpacesContent {...props} collapsed={collapsed} onToggle={toggle} />
      </div>
    </div>
  );
}

type ContentProps = Props & { collapsed: ReadonlySet<string>; onToggle: (id: string) => void };

function SpacesContent(props: ContentProps) {
  const load = props.space ? props.members : props.overview;
  // The groups failing also leaves the filter and the totals empty: «Reintentar» either way.
  const failed = [props.overview, load].find((candidate) => candidate?.status === 'error');
  if (failed?.status === 'error') return <section className="rounded-xl border border-outline/15 bg-surface"><ErrorNote message={failed.message} onRetry={props.onRetry} /></section>;
  if (!load || load.status === 'loading') return <section className={`${CARD} max-md:rounded-xl max-md:border max-md:border-outline/15 max-md:bg-surface`}><SkeletonRows /></section>;
  if (props.space && props.members?.status === 'ready') return <SelectedSpace page={props.members.data} space={props.space} searched={props.searched} onPage={props.onPage} />;
  return props.overview.status === 'ready' ? <Groups overview={props.overview.data} collapsed={props.collapsed} onToggle={props.onToggle} onSpace={props.onSpace} onPage={props.onPage} /> : null;
}

type FilterOption = { id: string | null; testid: string; name: string; count: number; logoUrl: string | null };

function filterOptions(overview: AdminSpacesOverview | null): FilterOption[] {
  if (!overview) return [];
  return [
    { id: null, testid: 'todos', name: 'Todos los espacios', count: overview.people, logoUrl: null },
    ...overview.spaces.map((space) => ({ id: space.id, testid: space.id, name: space.name, count: space.members, logoUrl: space.logoUrl })),
    { id: ADMIN_NO_SPACE, testid: 'sin', name: 'Sin espacio', count: overview.noSpace.members, logoUrl: null },
  ];
}

function OptionIcon({ option, size }: { option: FilterOption; size: number }) {
  if (option.id === null) return <Building2 size={18} aria-hidden />;
  if (option.id === ADMIN_NO_SPACE) return <NoSpaceMark size={size} />;
  return <SpaceLogo space={{ name: option.name, logoUrl: option.logoUrl ?? undefined }} size={size} />;
}

const NoSpaceMark = ({ size }: { size: number }) => (
  <span aria-hidden style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-md border border-dashed border-outline/40 text-on-surface-variant">
    <Minus size={size / 2} />
  </span>
);

/** The column (from `lg`) and the chips (below): the same options, the same `admin-filtro-*` ids. */
function SpaceFilter({ overview, space, onSpace }: { overview: AdminSpacesOverview | null; space: string | null; onSpace: (space: string | null) => void }) {
  const options = filterOptions(overview);
  return (
    <>
      <aside className="hidden lg:block">
        <nav aria-label="Espacios" className="rounded-xl border border-outline/15 bg-surface p-3">
          <p className={`${KICKER} px-3 pb-2 pt-1`}>Espacios</p>
          {options.map((option) => (
            <FilterRow key={option.testid} option={option} selected={option.id === space} onSpace={onSpace} />
          ))}
        </nav>
        <p className="mt-3 px-3 text-[12px] text-on-surface-variant">Una persona en varios espacios aparece en cada uno.</p>
      </aside>
      <nav aria-label="Espacios" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {options.map((option) => (
          <button key={option.testid} type="button" data-testid={`admin-filtro-${option.testid}`} aria-pressed={option.id === space} onClick={() => onSpace(option.id)} className={`flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${option.id === space ? 'border-primary bg-primary text-on-primary' : 'border-outline/20 bg-surface'}`}>
            {option.id === null ? null : <OptionIcon option={option} size={20} />}
            <span className="max-w-[10rem] truncate">{option.id === null ? 'Todos' : option.name}</span>
            <span className={`tabular-nums ${option.id === space ? '' : 'font-normal text-on-surface-variant'}`}>{option.count}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

function FilterRow({ option, selected, onSpace }: { option: FilterOption; selected: boolean; onSpace: (space: string | null) => void }) {
  const tone = selected ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-transparent hover:bg-background';
  return (
    <>
      {option.id === ADMIN_NO_SPACE ? <hr className="mx-3 my-2 border-outline/15" /> : null}
      <button type="button" data-testid={`admin-filtro-${option.testid}`} aria-pressed={selected} onClick={() => onSpace(option.id)} className={`flex h-12 w-full items-center gap-3 rounded-lg border-l-4 px-3 text-left text-sm ${tone}`}>
        <OptionIcon option={option} size={28} />
        <span className="min-w-0 flex-1 truncate">{option.name}</span>
        <span className="tabular-nums text-[12px] text-on-surface-variant">{option.count}</span>
      </button>
    </>
  );
}

type GroupsProps = { overview: AdminSpacesOverview; collapsed: ReadonlySet<string>; onToggle: (id: string) => void; onSpace: (space: string | null) => void; onPage: (page: number) => void };

function Groups({ overview, collapsed, onToggle, onSpace, onPage }: GroupsProps) {
  if (overview.groups.length === 0 && overview.noSpace.members === 0) return <section className="rounded-xl border border-outline/15 bg-surface"><EmptyNote /></section>;
  return (
    <>
      {overview.groups.map((group) => (
        <SpaceCard key={group.id} space={group} open={!collapsed.has(group.id)} onToggle={() => onToggle(group.id)}>
          <MemberRows members={group.preview} />
          <SeeAll count={group.members} shown={group.preview.length} label={`Ver los ${group.members} de ${group.name}`} testid={group.id} onClick={() => onSpace(group.id)} />
        </SpaceCard>
      ))}
      {overview.noSpace.members > 0 ? (
        <NoSpaceCard count={overview.noSpace.members}>
          <MemberRows members={overview.noSpace.preview} />
          <SeeAll count={overview.noSpace.members} shown={overview.noSpace.preview.length} label={`Ver los ${overview.noSpace.members} sin espacio`} testid="sin" onClick={() => onSpace(ADMIN_NO_SPACE)} />
        </NoSpaceCard>
      ) : null}
      <div className="rounded-xl border border-outline/15 bg-surface md:border-0 md:bg-transparent">
        <Pager label={adminSpacesRange({ spaces: overview.groups.length, people: overview.people })} page={overview.page} last={lastPage(overview.spaces.length, overview.pageSize)} onPage={onPage} />
      </div>
    </>
  );
}

function SelectedSpace({ page, space, searched, onPage }: { page: AdminSpaceMembersPage; space: string; searched: boolean; onPage: (page: number) => void }) {
  const list = page.members.length === 0 ? <EmptyNote text={searched ? undefined : NOBODY_ACTIVE} /> : <MemberRows members={page.members} />;
  const pager = <Pager label={adminUsersRange(page)} page={page.page} last={lastPage(page.total, page.pageSize)} onPage={onPage} />;
  if (!page.space) return <NoSpaceCard count={page.total}>{list}{pager}</NoSpaceCard>;
  return <SpaceCard key={space} space={page.space}>{list}{pager}</SpaceCard>;
}

/** A space's card: square, name, «N miembros · M activos hoy» and, in the groups, Contraer/Expandir. */
function SpaceCard({ space, open = true, onToggle, children }: { space: AdminSpaceSummary; open?: boolean; onToggle?: () => void; children: ReactNode }) {
  return (
    <section data-testid={`admin-espacio-${space.id}`} className={CARD}>
      <header className={`flex items-center gap-3 border-outline/15 bg-surface px-4 py-3 max-md:rounded-xl max-md:border md:px-6 ${open ? 'md:border-b' : ''}`}>
        <SpaceLogo space={{ name: space.name, logoUrl: space.logoUrl ?? undefined }} size={44} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{space.name}</h2>
          <p className="text-[13px] text-on-surface-variant md:font-mono md:text-[12px]">{adminSpaceLine(space)}</p>
        </div>
        {onToggle ? (
          <button type="button" aria-expanded={open} aria-label={open ? 'Contraer' : 'Expandir'} onClick={onToggle} className="flex h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-on-surface-variant md:border md:border-outline/20">
            <span className="max-md:hidden">{open ? 'Contraer' : 'Expandir'}</span>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        ) : null}
      </header>
      {open ? children : null}
    </section>
  );
}

function NoSpaceCard({ count, children }: { count: number; children: ReactNode }) {
  return (
    <section data-testid="admin-sin-espacio" className="md:overflow-hidden md:rounded-xl md:border md:border-dashed md:border-outline/30 md:bg-surface">
      <header className="flex items-center gap-3 border-dashed border-outline/30 bg-surface px-4 py-3 max-md:rounded-xl max-md:border md:border-b md:px-6">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-dashed border-outline/40 text-on-surface-variant"><UserX size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">Sin espacio</h2>
          <p className="text-[12px] text-on-surface-variant">{adminNoSpaceLine(count)}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function SeeAll({ count, shown, label, testid, onClick }: { count: number; shown: number; label: string; testid: string; onClick: () => void }) {
  if (count <= shown) return null;
  return (
    <div className="px-4 py-3 md:border-t md:border-outline/10 md:px-6">
      <button type="button" data-testid={`admin-ver-${testid}`} onClick={onClick} className="min-h-11 text-sm font-semibold text-primary hover:underline">{label} ›</button>
    </div>
  );
}

function MemberRows({ members }: { members: AdminSpaceMember[] }) {
  return (
    <>
      <div className={`hidden border-b border-outline/10 px-6 py-2 ${MEMBER_COLUMNS} ${KICKER}`}>
        <span>Persona</span><span>Rol</span><span>Correo</span><span className="whitespace-nowrap">Se unió</span><span className="whitespace-nowrap">Última vez</span><span>Dispositivos</span><span className="whitespace-nowrap">Lo invitó</span>
      </div>
      <ul className="max-md:mt-3 max-md:space-y-3 md:divide-y md:divide-outline/10">
        {members.map((member) => <MemberRow key={member.id} member={member} />)}
      </ul>
    </>
  );
}

function RoleAndHidden({ member }: { member: AdminSpaceMember }) {
  if (!member.role) return <Dash />;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <RolePill role={member.role} />
      {member.hidden ? <span className={`${PILL} border-outline/30 bg-background text-on-surface-variant`}>Oculto</span> : null}
    </span>
  );
}

function AlsoIn({ member }: { member: AdminSpaceMember }) {
  const label = adminAlsoInLabel(member.alsoIn);
  if (!label) return null;
  return <span title={label} className="mt-1 inline-block max-w-full truncate rounded-md md:whitespace-normal border border-outline/20 bg-background px-1.5 text-[11px] leading-5 text-on-surface-variant">{label}</span>;
}

/** A row of the table from `md`; below, a card: person and role, then the email and two facts per line. */
function MemberRow({ member }: { member: AdminSpaceMember }) {
  return (
    <li data-testid={`admin-miembro-${member.id}`} className={`grid grid-cols-2 gap-x-3 gap-y-1 bg-surface px-4 py-3 max-md:rounded-xl max-md:border max-md:border-outline/15 max-md:p-4 md:px-6 ${MEMBER_COLUMNS}`}>
      <div className="col-span-2 max-md:mb-2 max-md:border-b max-md:border-outline/10 max-md:pb-3 md:col-span-1">
        <PersonCell user={member} under={<AlsoIn member={member} />} aside={<span className="md:hidden"><RoleAndHidden member={member} /></span>} />
      </div>
      <div className="hidden md:block"><RoleAndHidden member={member} /></div>
      <Cell label="Correo" className="col-span-2 md:col-span-1"><EmailValue user={member} /></Cell>
      <Cell label="Se unió">{adminJoinedLabel(member.joinedAt)}</Cell>
      <Cell label="Última vez">{adminLastSeenLabel(member.lastSeenAt)}</Cell>
      <Cell label="Dispositivos">{adminDevicesLabel(member.devices)}</Cell>
      <Cell label="Lo invitó">{member.invitedBy ?? <Dash />}</Cell>
    </li>
  );
}
