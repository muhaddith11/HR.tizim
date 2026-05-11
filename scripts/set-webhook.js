// node scripts/set-webhook.js https://sizning-url.railway.app
const appUrl = process.argv[2]
const token = process.env.BOT_TOKEN || '8251395742:AAGzAJec1vBvYgdqQIH6tPn7qoMKkelnlqs'

if (!appUrl) {
  console.error('Usage: node scripts/set-webhook.js https://your-app-url.railway.app')
  process.exit(1)
}

const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/bot`

fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] }),
})
  .then(r => r.json())
  .then(d => {
    if (d.ok) console.log('✅ Webhook o\'rnatildi:', webhookUrl)
    else console.error('❌ Xatolik:', d.description)
  })
  .catch(e => console.error('❌', e.message))
