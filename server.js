const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const { Resend } = require('resend');

const app = express();
app.use(cors());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// 🔥 WEBHOOK (ANTES de express.json)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log('❌ Error webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const customerEmail = session.customer_details?.email || '';
    const productName = session.metadata?.productName || 'Producto digital';
    const downloadUrl = session.metadata?.downloadUrl || 'https://www.oletoursamui.com';

    console.log('✅ PAGO CONFIRMADO:', productName);

    try {
      await resend.emails.send({
        from: 'Olé Tours <info@oletoursamui.com>',
        to: [customerEmail],
        subject: `Tu compra está lista: ${productName}`,
        html: `
<div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; text-align:center;">

  <!-- LOGO -->
  <img src="https://primary.jwwb.nl/public/q/x/b/temp-rxsbzwvfehskyqcezfxp/ol-tours-3-high-dkf666.png?enable-io=true&crop=1%3A1&width=347" 
       style="width:90px; margin-bottom:20px;">

  <!-- TITULO -->
  <h2 style="margin-bottom:10px;">Tu ${productName} ya está listo</h2>

  <!-- TEXTO -->
  <p style="margin-bottom:20px;">
    Accede ahora a tu <strong>${productName}</strong>
  </p>

  <!-- BOTÓN -->
  <a href="${downloadUrl}" 
     style="display:inline-block; padding:14px 24px; background:#76c5cc; color:#fff; text-decoration:none; border-radius:8px; font-weight:bold;">
     Descargar ahora
  </a>

  <!-- TEXTO -->
  <p style="font-size:13px; color:#777; margin-top:20px;">
    Guarda este email para acceder cuando quieras.
  </p>

</div>
`
      });

      console.log('📧 Email enviado');

    } catch (error) {
      console.error('❌ Error email:', error);
    }
  }

  res.status(200).json({ received: true });
});

app.use(express.json());

// 🔥 CREAR PAGO (GENÉRICO MULTIPRODUCTO)
app.post('/crear-pago-digital', async (req, res) => {
  try {
    const { amount, productName, downloadUrl, successUrl } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],

      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: productName
            }
          },
          quantity: 1
        }
      ],

      mode: 'payment',

      metadata: {
        productName,
        downloadUrl
      },

      success_url: successUrl,
      cancel_url: 'https://www.oletoursamui.com/compra-cancelada'
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando pago' });
  }
});

// 🔥 WAKEUP ENDPOINT
app.get('/', (req, res) => {
  res.send('Servidor activo');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Servidor corriendo en puerto', PORT);
});
