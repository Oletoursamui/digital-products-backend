const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
app.use(cors());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
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

    console.log('✅ PAGO DIGITAL CONFIRMADO');
    console.log('Producto:', productName);
    console.log('Email:', customerEmail);

    try {
      await resend.emails.send({
        from: 'Olé Tours <info@oletoursamui.com>',
        to: [customerEmail],
        subject: `Tu compra está lista: ${productName}`,
        html: `
        <div style="font-family: Arial; max-width:600px; margin:auto; padding:20px;">
          
          <h2 style="color:#23a0ac;">Gracias por tu compra</h2>

          <p>Tu producto digital ya está disponible:</p>

          <p><strong>${productName}</strong></p>

          <a href="${downloadUrl}" 
             style="display:inline-block; margin:20px 0; padding:12px 20px; background:#23a0ac; color:#fff; border-radius:8px; text-decoration:none;">
             Acceder a la descarga
          </a>

          <p style="font-size:13px; color:#666;">
          Guarda este email por si necesitas acceder más tarde.
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


// 🔥 CREAR PAGO DIGITAL (GENÉRICO)
app.post('/crear-pago-digital', async (req, res) => {
  try {
    const { amount, productName, downloadUrl } = req.body;

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
        productName: productName,
        downloadUrl: downloadUrl
      },

      success_url: 'https://www.oletoursamui.com/compra-confirmada',
      cancel_url: 'https://www.oletoursamui.com/pago-cancelado'
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando pago' });
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Servidor digital corriendo en puerto', PORT);
});
