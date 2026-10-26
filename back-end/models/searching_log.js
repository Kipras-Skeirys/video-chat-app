const mongoose = require('mongoose')

const Schema = mongoose.Schema

const searching_logSchema = new Schema({
        uid: {
            type: String,
            required: true
        },
        matching_pref: {
            type: Object,
            required: true
        },
        start_time: {
            type: Number,
            required: true
        },
        end_time: {
            type: Number,
            required: false
        },
        ended_by: {
            type: String,
            required: false
        },
        end_reason: {
            type: String,
            required: false
        }
    }, {
        versionKey: false
    }
)

const Searching_log = mongoose.model('Searching_log', searching_logSchema)

module.exports = Searching_log