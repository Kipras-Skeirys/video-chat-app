const mongoose = require('mongoose')

const Schema = mongoose.Schema

const connecting_logSchema = new Schema({
        status: {
            type: String,
            required: true
        },
        sid: {
            type: String,
            required: true
        },
        start_time: {
            type: Number,
            required: true
        },
        end_time: {
            type: Number,
            required: false
        }
    }, {
        versionKey: false
    }
)

const Connecting_log = mongoose.model('Connecting_log', connecting_logSchema)

module.exports = Connecting_log