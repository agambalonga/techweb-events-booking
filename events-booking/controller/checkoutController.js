const { Router }  = require('express');
const User = require('../model/User');
const Event = require('../model/Event');
const mongoose = require('mongoose');

module.exports.getCheckout = (req, res) => {

    let total = 0;

    if(typeof req.session.cart !== "undefined" && req.session.cart.length > 0) {

        req.session.cart.forEach(item => {
            total += item.event_price * item.event_quantity;
        });

    }

    res.render('checkout', {total: total});
}

module.exports.postCheckout = async (req, res) => {
    console.log(req.body)
    const session = await mongoose.startSession();

    session.startTransaction();

    let user = await User.findOne({_id: req.body.user_id});
    
    var totalToPay = 0;

    req.session.cart.forEach(item => {
        totalToPay += item.event_price * item.event_quantity;
    });

    try {
        if(req.body.billing_info.payment_method == 'eb-credit') {
            if(user.wallet >= totalToPay) {
                await handlePayment(user, req, session);
                user.wallet -= totalToPay;
            } else {
                let err = new Error('Not enough credit');
                err.code = 'EB002';
                err.message = 'Not enough credit to complete checkout';
                throw err;
            }
        } else {
            await handlePayment(user, req, session);
        }

        await user.save({session: session});

        console.log('before commit transaction');
        await session.commitTransaction();
        console.log('after commit transaction');

        req.session.cart = [];
        session.endSession();
        res.sendStatus(200);

    } catch (err) {
        console.log(err);
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({code: err.code, message: err.message});

        return; 
    }
};

async function handlePayment(user, req, session) {
    for(item of req.session.cart) {
        let event = await Event.findOne({_id: item.event_id});
        if(event.seats >= item.event_quantity) {
            console.log('before update event')
            await Event.updateOne({_id: item.event_id}, {$inc: {seats: -item.event_quantity}}, {session: session});
            console.log('event updated');
            user.events_booked.push({event_id: item.event_id, event_name: item.event_title, artist_name: item.artist_name, qty: item.event_quantity, event_img_URL: item.event_img, event_city: item.event_city, event_date: item.event_date, booking_date: new Date()});
            
            if(req.body.billing_info.payment_method == 'eb-credit') {
                user.transactions.push({date: new Date(), description: 'Payment with EventBooking credit', sign: '-', amount: item.event_price * item.event_quantity});
            } else {
                const random = Math.floor(Math.random() * 10) + 1;
                //simulazione pagamento andato a buon fine o meno
                if(random<3) {
                    let err = new Error('Payment failed');
                    err.code = 'EB003';
                    err.message = 'Payment failed';
                    throw err;
                }
                user.transactions.push({date: new Date(), description: 'Payment with credit card '+getLastFourNumberOfCard(req.body.billing_info.card_number), sign: '-', amount: item.event_price * item.event_quantity});
            }

        } else {
            let err = new Error('Not enough seats available for event '+ item.event_id);
            err.code = 'EB001';
            err.message = 'Not enough seats available for event '+ item.event_id;
            err.event = event;
            throw err;
        }
    };

};

const getLastFourNumberOfCard = (cardNumber) => {
    return 'XXXX XXXX XXXX ' + cardNumber.substring(cardNumber.length - 4, cardNumber.length);
};