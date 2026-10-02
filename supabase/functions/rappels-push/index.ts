// Prospect’Immo — envoi des notifications (relances, rendez-vous, résumé du matin).
// Fonction Supabase (« Edge Function »), appelée toutes les 5 minutes par une tâche planifiée.
// Secrets à définir dans Supabase (Edge Functions → Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (générées dans Prospect’Immo : Paramètres → Notifications)
//   VAPID_SUJET                         (ex. « mailto:votre.adresse@gmail.com »)
//   CLE_PLANIFICATION                   (mot de passe au choix, repris dans la tâche planifiée)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

interface Rappel {
  user_id: string
  cle: string
  titre: string
  corps: string
  url: string
}

Deno.serve(async (req) => {
  if (req.headers.get('x-linkimmo-cle') !== Deno.env.get('CLE_PLANIFICATION')) return new Response('Accès refusé', { status: 401 })

  webpush.setVapidDetails(Deno.env.get('VAPID_SUJET') ?? 'mailto:contact@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const { data: rappels, error } = await sb.rpc('rappels_a_envoyer')
  if (error) return new Response(error.message, { status: 500 })
  const liste = (rappels ?? []) as Rappel[]
  if (liste.length === 0) return Response.json({ envoyees: 0 })

  const utilisateurs = [...new Set(liste.map((r) => r.user_id))]
  const { data: abonnements } = await sb.from('abonnements_push').select('endpoint, user_id, p256dh, auth').in('user_id', utilisateurs)

  let envoyees = 0
  const perimes: string[] = []
  const faits: { user_id: string; cle: string }[] = []
  for (const r of liste) {
    let ok = false
    for (const a of (abonnements ?? []).filter((x) => x.user_id === r.user_id)) {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          JSON.stringify({ titre: r.titre, corps: r.corps, url: r.url, tag: r.cle }),
          { TTL: 3600, urgency: 'high' },
        )
        ok = true
        envoyees++
      } catch (e) {
        const statut = (e as { statusCode?: number }).statusCode
        // Téléphone désinstallé ou notifications retirées : l'abonnement est supprimé.
        if (statut === 404 || statut === 410) perimes.push(a.endpoint)
        else console.error('Envoi impossible', statut, (e as Error).message)
      }
    }
    // Une notification est notée « envoyée » dès qu'un appareil l'a reçue (sinon : nouvel essai au prochain passage).
    if (ok) faits.push({ user_id: r.user_id, cle: r.cle })
  }
  if (faits.length) await sb.from('notifications_envoyees').upsert(faits, { onConflict: 'user_id,cle', ignoreDuplicates: true })
  if (perimes.length) await sb.from('abonnements_push').delete().in('endpoint', perimes)
  return Response.json({ envoyees, perimes: perimes.length })
})
