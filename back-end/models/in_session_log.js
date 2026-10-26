const mongoose = require('mongoose')

const Schema = mongoose.Schema

const in_session_logSchema = new Schema({
        sid: {
            type: String,
            required: true
        },
        users: {
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
        }
    }, {
        versionKey: false
    }
)

const In_session_log = mongoose.model('In_session_log', in_session_logSchema)

module.exports = In_session_log