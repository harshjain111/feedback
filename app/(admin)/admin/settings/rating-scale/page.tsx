import { redirect } from 'next/navigation'
import { ReferenceEditor } from '@/components/admin/ReferenceEditor'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { FaceIcon } from '@/components/kiosk/FaceIcon'
import { requireUser } from '@/lib/auth'
import { getRatingScale } from '@/lib/config'
import { can } from '@/lib/permissions'

/**
 * The rating scale (§37).
 *
 * Five rows, fixed: adding a sixth face would change what every historical
 * rating means, so the set is edited, never extended, from here.
 *
 * The colours are shown as the guest sees them, at size, because a hex value in
 * a table tells you nothing about whether the ramp still reads red → green
 * across a room — which is the only thing that matters about it (§5).
 */
export default async function SettingsRatingScalePage() {
  const user = await requireUser('/admin/settings/rating-scale')
  if (!can(user, 'manage:cms')) redirect('/admin')

  const scale = await getRatingScale()

  return (
    <div className="max-w-3xl space-y-4">
      <SectionHeading
        title="Rating scale"
        note="The face is the primary interaction, and colour has to register before the label does."
      />

      <div className="border-line bg-surface rounded-2xl border p-6">
        <div className="flex items-start justify-between gap-4">
          {scale.map((face) => (
            <div key={face.scale_id} className="flex flex-col items-center gap-2">
              <FaceIcon faceKey={face.face_key} colour={face.colour} size={84} />
              <span className="text-ink-soft text-xs">{face.label}</span>
            </div>
          ))}
        </div>
      </div>

      <ReferenceEditor
        table="rating_scale"
        idColumn="scale_id"
        fixedRows
        deactivateWarning="Deactivating a step removes it from the kiosk but keeps every rating already given at that value. Changing the number of steps changes what past scores mean — do it only with the client's agreement."
        columns={[
          {
            key: 'face_key',
            label: 'Face',
            type: 'select',
            options: ['angry', 'sad', 'neutral', 'happy', 'delighted'],
          },
          { key: 'label', label: 'Label', width: '40%' },
          { key: 'colour', label: 'Colour', type: 'colour' },
        ]}
        rows={scale.map((face) => ({
          id: face.scale_id,
          active: true,
          values: { face_key: face.face_key, label: face.label, colour: face.colour },
        }))}
      />
    </div>
  )
}
