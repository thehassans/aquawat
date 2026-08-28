import SalesConfigCrud from './SalesConfigCrud'

export default function ActivityTypesPage() {
  return (
    <SalesConfigCrud
      title="Activity Types"
      subtitle="Call, email, meeting templates for follow-ups"
      apiPath="/sales/activity-types"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'kind', label: 'Kind' },
        { key: 'defaultDurationMinutes', label: 'Duration (min)' },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'nameAr', label: 'Name (AR)' },
        { key: 'kind', label: 'Kind', type: 'select', default: 'call', options: [
          { value: 'call', label: 'Call' },
          { value: 'email', label: 'Email' },
          { value: 'meeting', label: 'Meeting' },
          { value: 'task', label: 'Task' },
        ] },
        { key: 'defaultDurationMinutes', label: 'Duration (minutes)', type: 'number', default: 30 },
        { key: 'icon', label: 'Icon', default: 'phone' },
      ]}
    />
  )
}
