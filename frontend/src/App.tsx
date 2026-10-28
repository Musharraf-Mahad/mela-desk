import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
type TicketCategory = 'technical' | 'account' | 'billing' | 'orders' | 'general'
type AppView = 'overview' | 'tickets'

interface Ticket {
  id: string
  subject: string
  description: string
  requester: string
  requesterEmail: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  assignee: string
  createdAt: string
  createdLabel: string
}

interface TicketForm {
  requester: string
  requesterEmail: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  description: string
}

type IconName = 'grid' | 'ticket' | 'book' | 'chat' | 'chart' | 'search' | 'bell' | 'plus' | 'chevron' | 'clock' | 'check' | 'alert' | 'filter' | 'close' | 'sun' | 'moon' | 'arrow' | 'user' | 'sparkle'

const iconContent: Record<IconName, ReactNode> = {
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  ticket: <><path d="M4 7.5A2.5 2.5 0 0 0 6.5 5h11A2.5 2.5 0 0 0 20 7.5v1a2.5 2.5 0 0 0 0 5v1a2.5 2.5 0 0 0-2.5 2.5h-11A2.5 2.5 0 0 0 4 14.5v-1a2.5 2.5 0 0 0 0-5z" /><path d="M9 8.5v2M9 13.5v2" /></>,
  book: <><path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h13v17H7a2.5 2.5 0 0 0-2.5 2z" /><path d="M4.5 5.5v16.5M8.5 7h7M8.5 11h7" /></>,
  chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-3.5 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
  chart: <><path d="M4 19.5h16" /><path d="M7 16v-4M12 16V6M17 16V9" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><path d="M10.3 4.4 2.9 17.2A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.8L13.7 4.4a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 16.5h.01" /></>,
  filter: <><path d="M4 6h16M7 12h10m-7 6h4" /></>,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
  moon: <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.7 8.7 0 1 0 20.5 14.2Z" />,
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  sparkle: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></>,
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconContent[name]}</svg>
}

const initialTickets: Ticket[] = [
  { id: 'MD-1048', subject: 'VPN disconnects every few minutes', description: 'The VPN connection drops every few minutes when I am working remotely. I have restarted the client and my laptop.', requester: 'Priya Patel', requesterEmail: 'priya.patel@example.com', category: 'technical', priority: 'high', status: 'in_progress', assignee: 'Sophie Turner', createdAt: '2026-10-28', createdLabel: '9:41 AM' },
  { id: 'MD-1047', subject: 'Access needed for the Finance shared drive', description: 'Please grant access to the Finance team shared drive for the new quarterly review.', requester: 'Amina Hassan', requesterEmail: 'amina.hassan@example.com', category: 'account', priority: 'urgent', status: 'open', assignee: 'Unassigned', createdAt: '2026-10-28', createdLabel: '9:18 AM' },
  { id: 'MD-1046', subject: 'Outlook calendar is not syncing', description: 'Events added on my phone are not showing up in Outlook on my work computer.', requester: 'Marcus Chen', requesterEmail: 'marcus.chen@example.com', category: 'technical', priority: 'medium', status: 'open', assignee: 'Unassigned', createdAt: '2026-10-28', createdLabel: '8:56 AM' },
  { id: 'MD-1045', subject: 'Request a replacement keyboard', description: 'Several keys on my keyboard have stopped responding. Can I request a replacement?', requester: 'Sofia Garcia', requesterEmail: 'sofia.garcia@example.com', category: 'general', priority: 'low', status: 'resolved', assignee: 'Daniel Kim', createdAt: '2026-10-27', createdLabel: 'Yesterday' },
  { id: 'MD-1044', subject: 'MFA reset after replacing my phone', description: 'I have a new phone and can no longer approve sign-in requests with the authenticator app.', requester: 'Ethan Park', requesterEmail: 'ethan.park@example.com', category: 'account', priority: 'high', status: 'in_progress', assignee: 'Sophie Turner', createdAt: '2026-10-27', createdLabel: 'Yesterday' },
  { id: 'MD-1043', subject: 'Printer queue is stuck on floor 3', description: 'Documents are not printing from the third-floor shared printer. The queue has been stuck since this morning.', requester: 'Olivia Martin', requesterEmail: 'olivia.martin@example.com', category: 'technical', priority: 'medium', status: 'closed', assignee: 'Daniel Kim', createdAt: '2026-10-26', createdLabel: 'Oct 26' },
  { id: 'MD-1042', subject: 'Laptop request for a new team member', description: 'A new team member starts next week and needs a standard company laptop prepared.', requester: 'Noah Williams', requesterEmail: 'noah.williams@example.com', category: 'orders', priority: 'medium', status: 'open', assignee: 'Unassigned', createdAt: '2026-10-26', createdLabel: 'Oct 26' },
  { id: 'MD-1041', subject: 'Incorrect charge on software subscription', description: 'The monthly subscription renewal appears to have been charged twice this month.', requester: 'Isabella Brown', requesterEmail: 'isabella.brown@example.com', category: 'billing', priority: 'high', status: 'resolved', assignee: 'Sophie Turner', createdAt: '2026-10-25', createdLabel: 'Oct 25' },
]

const statusLabels: Record<TicketStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }
const priorityLabels: Record<TicketPriority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }
const categoryLabels: Record<TicketCategory, string> = { technical: 'Technical', account: 'Account access', billing: 'Billing', orders: 'Hardware & orders', general: 'General' }
const emptyForm: TicketForm = { requester: '', requesterEmail: '', subject: '', category: 'technical', priority: 'medium', description: '' }

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`md-status md-status-${status}`}><span className="md-status-dot" />{statusLabels[status]}</span>
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={`md-priority md-priority-${priority}`}><span className="md-priority-mark">{priority === 'urgent' ? '!' : '•'}</span>{priorityLabels[priority]}</span>
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}

function App() {
  const [tickets, setTickets] = useState(initialTickets)
  const [view, setView] = useState<AppView>('overview')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | TicketCategory>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>('all')
  const [requesterFilter, setRequesterFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [form, setForm] = useState<TicketForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [createdMessage, setCreatedMessage] = useState('')
  const [ticketSequence, setTicketSequence] = useState(1049)

  const visibleTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const normalizedRequester = requesterFilter.trim().toLowerCase()
    const normalizedAssignee = assigneeFilter.trim().toLowerCase()

    return tickets.filter((ticket) => {
      const matchesSearch = !normalizedSearch || [ticket.id, ticket.subject, ticket.description, ticket.requester, ticket.requesterEmail, ticket.assignee, categoryLabels[ticket.category]].some((value) => value.toLowerCase().includes(normalizedSearch))
      return matchesSearch
        && (statusFilter === 'all' || ticket.status === statusFilter)
        && (categoryFilter === 'all' || ticket.category === categoryFilter)
        && (priorityFilter === 'all' || ticket.priority === priorityFilter)
        && (!normalizedRequester || ticket.requester.toLowerCase().includes(normalizedRequester) || ticket.requesterEmail.toLowerCase().includes(normalizedRequester))
        && (!normalizedAssignee || ticket.assignee.toLowerCase().includes(normalizedAssignee))
        && (!fromDate || ticket.createdAt >= fromDate)
        && (!toDate || ticket.createdAt <= toDate)
    })
  }, [tickets, search, statusFilter, categoryFilter, priorityFilter, requesterFilter, assigneeFilter, fromDate, toDate])

  const openCount = tickets.filter((ticket) => ticket.status === 'open').length
  const inProgressCount = tickets.filter((ticket) => ticket.status === 'in_progress').length
  const resolvedCount = tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length
  const urgentCount = tickets.filter((ticket) => ticket.priority === 'urgent').length
  const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setCategoryFilter('all')
    setPriorityFilter('all')
    setRequesterFilter('')
    setAssigneeFilter('')
    setFromDate('')
    setToDate('')
  }

  function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const requester = form.requester.trim()
    const email = form.requesterEmail.trim()
    const subject = form.subject.trim()
    const description = form.description.trim()
    if (!requester || !email || !subject || !description) {
      setFormError('Complete each required field to create a ticket.')
      return
    }

    const now = new Date()
    const newTicket: Ticket = {
      id: `MD-${ticketSequence}`,
      subject,
      description,
      requester,
      requesterEmail: email,
      category: form.category,
      priority: form.priority,
      status: 'open',
      assignee: 'Unassigned',
      createdAt: now.toISOString().slice(0, 10),
      createdLabel: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }
    setTickets((current) => [newTicket, ...current])
    setTicketSequence((current) => current + 1)
    setForm(emptyForm)
    setFormError('')
    setCreatedMessage(`${newTicket.id} added to this preview. It has not been saved to a server.`)
    setView('tickets')
    clearFilters()
    setIsCreateOpen(false)
  }

  return (
    <div className={`md-app${isDark ? ' md-dark' : ''}`}>
      <aside className="md-sidebar">
        <a className="md-brand" href="#overview" onClick={(event) => { event.preventDefault(); setView('overview') }} aria-label="MELA DESK home">
          <span className="md-brand-mark"><span /><span /><span /><span /></span>
          <span className="md-brand-name">mela<span>desk</span><small>IT SUPPORT</small></span>
        </a>
        <div className="md-workspace-switcher"><span className="md-workspace-avatar">AC</span><span className="md-workspace-copy"><strong>Acme Corporation</strong><small>Support workspace</small></span><span className="md-workspace-caret">⌄</span></div>
        <p className="md-nav-heading">WORKSPACE</p>
        <nav className="md-nav" aria-label="Main navigation">
          <button className={`md-nav-item${view === 'overview' ? ' is-active' : ''}`} onClick={() => setView('overview')}><Icon name="grid" /><span>Overview</span></button>
          <button className={`md-nav-item${view === 'tickets' ? ' is-active' : ''}`} onClick={() => setView('tickets')}><Icon name="ticket" /><span>Tickets</span><span className="md-nav-count">{tickets.length}</span></button>
          <button className="md-nav-item md-nav-upcoming" type="button" disabled title="Knowledge base is not connected yet"><Icon name="book" /><span>Knowledge base</span><span className="md-soon">Soon</span></button>
          <button className="md-nav-item md-nav-upcoming" type="button" disabled title="Live chat is not connected yet"><Icon name="chat" /><span>Live chat</span><span className="md-soon">Soon</span></button>
          <button className="md-nav-item md-nav-upcoming" type="button" disabled title="Reports are not connected yet"><Icon name="chart" /><span>Reports</span><span className="md-soon">Soon</span></button>
        </nav>
        <div className="md-sidebar-divider" />
        <p className="md-nav-heading">SUPPORT QUEUE</p>
        <div className="md-queue-links">
          <button onClick={() => { clearFilters(); setView('tickets'); setStatusFilter('open') }}><span className="md-queue-dot dot-blue" />Open tickets<span>{openCount}</span></button>
          <button onClick={() => { clearFilters(); setView('tickets'); setStatusFilter('in_progress') }}><span className="md-queue-dot dot-amber" />In progress<span>{inProgressCount}</span></button>
          <button onClick={() => { clearFilters(); setView('tickets'); setPriorityFilter('urgent') }}><span className="md-queue-dot dot-red" />Urgent priority<span>{urgentCount}</span></button>
        </div>
        <div className="md-sidebar-spacer" />
        <div className="md-roadmap-card"><span className="md-roadmap-icon"><Icon name="sparkle" size={17} /></span><strong>More support tools</strong><p>Live chat, knowledge base, and SLA tracking are planned next.</p><span className="md-roadmap-label">ON THE ROADMAP</span></div>
        <div className="md-sidebar-user"><span className="md-avatar md-avatar-agent">AM</span><span className="md-user-copy"><strong>Alex Morgan</strong><small>Support agent</small></span><button className="md-user-menu" aria-label="Account options">···</button></div>
      </aside>

      <main className="md-main">
        <header className="md-topbar">
          <div className="md-breadcrumb"><span>Workspace</span><Icon name="chevron" size={14} /><strong>{view === 'overview' ? 'Overview' : 'Tickets'}</strong></div>
          <div className="md-top-actions">
            <label className="md-global-search"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets, people..." aria-label="Search tickets and people" /><kbd>⌘ K</kbd></label>
            <div className="md-notification-wrap">
              <button className="md-icon-button md-notification-button" aria-label="Notifications" aria-expanded={isNotificationsOpen} onClick={() => setIsNotificationsOpen((current) => !current)}><Icon name="bell" size={18} /><span className="md-notification-dot" /></button>
              {isNotificationsOpen && <div className="md-notification-popover"><div className="md-popover-heading"><strong>Notifications</strong><span>Preview</span></div><p><span className="md-activity-dot activity-blue" />3 new tickets are waiting for triage</p><p><span className="md-activity-dot activity-green" />A ticket was marked resolved</p><small>Sample notifications · no email service connected</small></div>}
            </div>
            <span className="md-topbar-separator" />
            <button className="md-icon-button md-theme-toggle" aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} title={isDark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setIsDark((current) => !current)}><Icon name={isDark ? 'sun' : 'moon'} size={18} /></button>
            <span className="md-avatar md-avatar-agent md-top-avatar" aria-label="Alex Morgan">AM</span>
          </div>
        </header>

        <div className="md-content">
          <div className="md-page-heading"><div><div className="md-eyebrow">{todayLabel}</div><h1>{view === 'overview' ? 'Good morning, Alex' : 'Ticket management'}</h1><p>{view === 'overview' ? 'Here’s what’s happening across your support desk today.' : 'Review, search, and prioritize requests from your team.'}</p></div><div className="md-heading-actions"><span className="md-preview-pill"><span />Preview workspace</span><button className="md-primary-button" onClick={() => { setForm(emptyForm); setFormError(''); setIsCreateOpen(true) }}><Icon name="plus" size={17} />Create ticket</button></div></div>
          {createdMessage && <div className="md-inline-notice" role="status"><Icon name="check" size={16} /><span>{createdMessage}</span><button aria-label="Dismiss notice" onClick={() => setCreatedMessage('')}><Icon name="close" size={15} /></button></div>}

          {view === 'overview' && <>
            <section className="md-metrics" aria-label="Ticket summary">
              <article className="md-metric-card"><div className="md-metric-top"><span className="md-metric-label">Open tickets</span><span className="md-metric-icon metric-blue"><Icon name="ticket" size={17} /></span></div><strong className="md-metric-value">{openCount}</strong><div className="md-metric-foot"><span className="md-trend-up">↑ 12%</span><span>vs. last week</span></div><span className="md-sparkline spark-blue">{[34, 57, 42, 73, 54, 88, 66, 100, 79].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</span></article>
              <article className="md-metric-card"><div className="md-metric-top"><span className="md-metric-label">In progress</span><span className="md-metric-icon metric-violet"><Icon name="clock" size={17} /></span></div><strong className="md-metric-value">{inProgressCount}</strong><div className="md-metric-foot"><span className="md-neutral-trend">→ 2</span><span>updated today</span></div><span className="md-sparkline spark-violet">{[34, 57, 42, 73, 54, 88, 66, 100, 79].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</span></article>
              <article className="md-metric-card"><div className="md-metric-top"><span className="md-metric-label">Resolved</span><span className="md-metric-icon metric-green"><Icon name="check" size={17} /></span></div><strong className="md-metric-value">{resolvedCount}</strong><div className="md-metric-foot"><span className="md-trend-up">↑ 8%</span><span>vs. last week</span></div><span className="md-sparkline spark-green">{[34, 57, 42, 73, 54, 88, 66, 100, 79].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</span></article>
              <article className="md-metric-card"><div className="md-metric-top"><span className="md-metric-label">Urgent priority</span><span className="md-metric-icon metric-red"><Icon name="alert" size={17} /></span></div><strong className="md-metric-value">{urgentCount}</strong><div className="md-metric-foot"><span className="md-urgent-foot">Needs attention</span><span>in the queue</span></div><span className="md-sparkline spark-red">{[34, 57, 42, 73, 54, 88, 66, 100, 79].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</span></article>
            </section>
            <section className="md-insights-grid">
              <article className="md-panel md-volume-panel"><div className="md-panel-heading"><div><h2>Ticket activity</h2><p>Incoming requests over the last 7 days</p></div><button className="md-period-button" type="button">This week <span>⌄</span></button></div><div className="md-chart-wrap" role="img" aria-label="Sample bar chart showing daily ticket activity"><div className="md-chart-y-labels"><span>40</span><span>30</span><span>20</span><span>10</span><span>0</span></div><div className="md-chart-area"><div className="md-chart-grid"><i /><i /><i /><i /><i /></div><div className="md-chart-bars">{[['Mon', 42], ['Tue', 62], ['Wed', 52], ['Thu', 78], ['Fri', 60], ['Sat', 32], ['Sun', 48]].map(([day, height], index) => <div className="md-chart-column" key={day}><div className={`md-chart-bar${index === 3 ? ' is-highlighted' : ''}`} style={{ height: `${height}%` }}><span>{index === 3 ? '32' : ''}</span></div><span className="md-chart-day">{day}</span></div>)}</div></div></div><div className="md-chart-legend"><span><i className="legend-primary" />Ticket volume</span><span className="md-chart-footnote">Illustrative sample data</span></div></article>
              <article className="md-panel md-quick-panel"><div className="md-panel-heading"><div><h2>Quick overview</h2><p>At a glance</p></div><button className="md-more-button" aria-label="More overview options">···</button></div><div className="md-quick-stat"><span className="md-quick-icon quick-blue"><Icon name="clock" size={17} /></span><span><strong>1h 42m</strong><small>Avg. first response</small></span><span className="md-quick-change">↓ 18%</span></div><div className="md-quick-stat"><span className="md-quick-icon quick-green"><Icon name="check" size={17} /></span><span><strong>94.8%</strong><small>Resolution rate</small></span><span className="md-quick-change">↑ 4.2%</span></div><div className="md-quick-stat"><span className="md-quick-icon quick-amber"><Icon name="user" size={17} /></span><span><strong>6 <em>of 8</em></strong><small>Agents available</small></span><span className="md-availability"><i />Online</span></div><div className="md-quick-note"><Icon name="alert" size={16} /><span>SLA monitoring isn’t connected in this workspace.</span></div></article>
            </section>
          </>}

          <section className={`md-panel md-tickets-panel${view === 'tickets' ? ' md-tickets-panel-full' : ''}`} id="ticket-list">
            <div className="md-panel-heading md-tickets-heading"><div><h2>{view === 'overview' ? 'Recent tickets' : 'All tickets'}</h2><p>{view === 'overview' ? 'Stay on top of the latest support requests' : `${visibleTickets.length} matching ${visibleTickets.length === 1 ? 'ticket' : 'tickets'} in this preview`}</p></div><div className="md-table-actions"><button className={`md-filter-button${showAdvancedFilters ? ' is-selected' : ''}`} onClick={() => setShowAdvancedFilters((current) => !current)} aria-expanded={showAdvancedFilters}><Icon name="filter" size={16} />Filters</button><button className="md-outline-button" onClick={() => setView('tickets')}>View all <Icon name="arrow" size={14} /></button></div></div>
            <div className="md-ticket-toolbar"><div className="md-status-tabs" role="group" aria-label="Filter tickets by status">{([['all', 'All tickets'], ['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed']] as const).map(([key, label]) => <button key={key} className={statusFilter === key ? 'is-active' : ''} onClick={() => setStatusFilter(key)}>{label}{key === 'all' && <span>{tickets.length}</span>}</button>)}</div><label className="md-table-search"><Icon name="search" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets..." aria-label="Search tickets" /></label></div>
            <div className="md-inline-filters"><label><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'all' | TicketCategory)}><option value="all">All categories</option>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Priority</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'all' | TicketPriority)}><option value="all">All priorities</option>{Object.entries(priorityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{(categoryFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' || search) && <button className="md-clear-filters" onClick={clearFilters}>Clear filters</button>}</div>
            {showAdvancedFilters && <div className="md-advanced-filters"><label><span>Requester</span><input value={requesterFilter} onChange={(event) => setRequesterFilter(event.target.value)} placeholder="Name or email" /></label><label><span>Assigned agent</span><input value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} placeholder="Agent name" /></label><label><span>Created from</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label><span>Created to</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div>}
            <div className="md-ticket-table-wrap"><div className="md-ticket-table" role="table" aria-label="Support tickets"><div className="md-ticket-row md-ticket-header" role="row"><span role="columnheader">Ticket</span><span role="columnheader">Requester</span><span role="columnheader">Category</span><span role="columnheader">Priority</span><span role="columnheader">Status</span><span role="columnheader">Assignee</span><span role="columnheader">Created</span><span aria-hidden="true" /></div>{visibleTickets.length > 0 ? visibleTickets.slice(0, view === 'overview' ? 6 : undefined).map((ticket) => <button className="md-ticket-row md-ticket-item" role="row" key={ticket.id} onClick={() => setSelectedTicket(ticket)}><span className="md-ticket-title" role="cell"><strong>{ticket.subject}</strong><small>{ticket.id}</small></span><span className="md-requester-cell" role="cell"><span className={`md-avatar md-avatar-${initials(ticket.requester).toLowerCase()}`}>{initials(ticket.requester)}</span><span>{ticket.requester}</span></span><span className="md-category-cell" role="cell">{categoryLabels[ticket.category]}</span><span role="cell"><PriorityBadge priority={ticket.priority} /></span><span role="cell"><StatusBadge status={ticket.status} /></span><span className="md-assignee-cell" role="cell">{ticket.assignee === 'Unassigned' ? <span className="md-unassigned">Unassigned</span> : <><span className="md-avatar md-avatar-sophie">{initials(ticket.assignee)}</span>{ticket.assignee}</>}</span><span className="md-created-cell" role="cell">{ticket.createdLabel}</span><span className="md-row-arrow" aria-hidden="true"><Icon name="chevron" size={15} /></span></button>) : <div className="md-empty-state"><span className="md-empty-icon"><Icon name="search" size={21} /></span><strong>No tickets match those filters</strong><p>Try another search or clear the active filters.</p><button onClick={clearFilters}>Clear filters</button></div>}</div></div>
            <div className="md-table-footer"><span>Showing <strong>{Math.min(visibleTickets.length, view === 'overview' ? 6 : visibleTickets.length)}</strong> of <strong>{visibleTickets.length}</strong> tickets <span className="md-sample-caption">· preview data</span></span><div><button disabled aria-label="Previous page">‹</button><span>1</span><button disabled aria-label="Next page">›</button></div></div>
          </section>
          <footer className="md-footer"><span>MELA DESK <span>·</span> IT support workspace</span><span>Sample data only · API connection not configured</span></footer>
        </div>
      </main>

      {isCreateOpen && <div className="md-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCreateOpen(false) }}><section className="md-modal" role="dialog" aria-modal="true" aria-labelledby="create-ticket-title"><div className="md-modal-heading"><div><span className="md-modal-kicker">SUPPORT REQUEST</span><h2 id="create-ticket-title">Create a ticket</h2><p>Share the issue and we’ll get it to the right person.</p></div><button className="md-icon-button" aria-label="Close dialog" onClick={() => setIsCreateOpen(false)}><Icon name="close" size={18} /></button></div><form onSubmit={createTicket}><div className="md-form-grid"><label className="md-form-field"><span>Requester name <b>*</b></span><input value={form.requester} onChange={(event) => setForm((current) => ({ ...current, requester: event.target.value }))} placeholder="e.g. Jordan Lee" required /></label><label className="md-form-field"><span>Email address <b>*</b></span><input type="email" value={form.requesterEmail} onChange={(event) => setForm((current) => ({ ...current, requesterEmail: event.target.value }))} placeholder="jordan@company.com" required /></label><label className="md-form-field md-form-wide"><span>Subject <b>*</b></span><input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="What do you need help with?" maxLength={255} required /></label><label className="md-form-field"><span>Category <b>*</b></span><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as TicketCategory }))}>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="md-form-field"><span>Priority</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TicketPriority }))}>{Object.entries(priorityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small>New tickets default to Medium.</small></label><label className="md-form-field md-form-wide"><span>Description <b>*</b></span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Tell us what happened and what you’ve already tried..." rows={4} maxLength={10000} required /></label></div>{formError && <p className="md-form-error" role="alert">{formError}</p>}<div className="md-modal-footnote"><Icon name="alert" size={15} /><span>This preview creates an in-memory ticket only. No email or server record will be generated.</span></div><div className="md-modal-actions"><button className="md-secondary-button" type="button" onClick={() => setIsCreateOpen(false)}>Cancel</button><button className="md-primary-button" type="submit"><Icon name="plus" size={16} />Create ticket</button></div></form></section></div>}

      {selectedTicket && <div className="md-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTicket(null) }}><section className="md-modal md-detail-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-detail-title"><div className="md-modal-heading"><div><span className="md-modal-kicker">{selectedTicket.id}</span><h2 id="ticket-detail-title">{selectedTicket.subject}</h2><p>Created by {selectedTicket.requester} · {selectedTicket.createdLabel}</p></div><button className="md-icon-button" aria-label="Close ticket details" onClick={() => setSelectedTicket(null)}><Icon name="close" size={18} /></button></div><div className="md-detail-badges"><StatusBadge status={selectedTicket.status} /><PriorityBadge priority={selectedTicket.priority} /><span className="md-detail-category">{categoryLabels[selectedTicket.category]}</span></div><div className="md-detail-section"><h3>Description</h3><p>{selectedTicket.description}</p></div><div className="md-detail-grid"><div><span>Requester</span><strong>{selectedTicket.requester}</strong><small>{selectedTicket.requesterEmail}</small></div><div><span>Assigned to</span><strong>{selectedTicket.assignee}</strong><small>Assignment requires a connected API</small></div></div><div className="md-modal-footnote"><Icon name="alert" size={15} /><span>Details are sample preview data and are not connected to a backend.</span></div><div className="md-modal-actions"><button className="md-secondary-button" onClick={() => setSelectedTicket(null)}>Close</button></div></section></div>}
    </div>
  )
}

export default App
