import { redirect } from 'next/navigation'
import { BackfillThemes } from '@/components/admin/BackfillThemes'
import { ReferenceEditor } from '@/components/admin/ReferenceEditor'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { ThemeKeywords } from '@/components/admin/ThemeKeywords'
import { requireUser } from '@/lib/auth'
import { AVAILABLE_ICONS } from '@/components/kiosk/CategoryIcon'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

/**
 * Categories, issue chips and the comment lexicon (§36).
 *
 * All three are the same kind of thing — reference rows the kiosk and the
 * analytics read — so they share one editor rather than three near-identical
 * screens.
 */
export default async function SettingsCategoriesPage() {
  const user = await requireUser('/admin/settings/categories')
  if (!can(user, 'manage:cms')) redirect('/admin')

  const client = await createClient()

  const [categories, issues, themes, keywords] = await Promise.all([
    client
      .from('categories')
      .select('category_id, name, question, icon, display_order, active')
      .eq('outlet_id', user.outletId)
      .order('display_order'),
    client
      .from('issues')
      .select('issue_id, name, kind, display_order, active')
      .eq('outlet_id', user.outletId)
      .order('kind')
      .order('display_order'),
    client
      .from('themes')
      .select('theme_id, name, kind, display_order, active')
      .eq('outlet_id', user.outletId)
      .order('kind')
      .order('display_order'),
    client.from('theme_keywords').select('theme_id, keyword').eq('active', true),
  ])

  const keywordsByTheme = new Map<string, string[]>()
  for (const row of keywords.data ?? []) {
    const list = keywordsByTheme.get(row.theme_id) ?? []
    list.push(row.keyword)
    keywordsByTheme.set(row.theme_id, list)
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading
          title="Categories"
          note="What the guest is asked to rate. Reordering here reorders the rate screen."
        />
        <ReferenceEditor
          table="categories"
          idColumn="category_id"
          addLabel="Add a category"
          deactivateWarning="Deactivating hides a category from the kiosk but keeps every past rating. Historical analytics and old feedback continue to show it — nothing is deleted."
          columns={[
            { key: 'name', label: 'Name', width: '18%' },
            { key: 'question', label: 'Question', width: '46%' },
            { key: 'icon', label: 'Icon', type: 'select', options: AVAILABLE_ICONS },
          ]}
          rows={(categories.data ?? []).map((row) => ({
            id: row.category_id,
            active: row.active,
            values: { name: row.name, question: row.question, icon: row.icon },
          }))}
        />
      </section>

      <section>
        <SectionHeading
          title="Issue chips"
          note="What a guest can point at. Negative chips appear after a low rating, positive ones after a high rating."
        />
        <ReferenceEditor
          table="issues"
          idColumn="issue_id"
          addLabel="Add a chip"
          deactivateWarning="Deactivating hides a chip from the kiosk but keeps every past selection, so the issue tables still show its history."
          columns={[
            { key: 'name', label: 'Label', width: '55%' },
            {
              key: 'kind',
              label: 'Shown after',
              type: 'select',
              options: ['negative', 'positive'],
            },
          ]}
          rows={(issues.data ?? []).map((row) => ({
            id: row.issue_id,
            active: row.active,
            values: { name: row.name, kind: row.kind },
          }))}
        />
      </section>

      <section>
        <SectionHeading
          title="Comment themes"
          note="The lexicon that turns free text into countable themes. Editing keywords changes what future comments match."
        />
        <ReferenceEditor
          table="themes"
          idColumn="theme_id"
          addLabel="Add a theme"
          deactivateWarning="Deactivating hides a theme from the analytics tables but keeps its past matches."
          columns={[
            { key: 'name', label: 'Theme', width: '55%' },
            { key: 'kind', label: 'Kind', type: 'select', options: ['negative', 'positive'] },
          ]}
          rows={(themes.data ?? []).map((row) => ({
            id: row.theme_id,
            active: row.active,
            values: { name: row.name, kind: row.kind },
          }))}
        />

        <div className="mt-4 space-y-3">
          {(themes.data ?? []).map((theme) => (
            <ThemeKeywords
              key={theme.theme_id}
              themeId={theme.theme_id}
              name={theme.name}
              kind={theme.kind}
              keywords={keywordsByTheme.get(theme.theme_id) ?? []}
            />
          ))}
        </div>

        <BackfillThemes />
      </section>
    </div>
  )
}
