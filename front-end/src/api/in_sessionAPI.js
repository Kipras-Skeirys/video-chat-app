
module.exports.end = function(data, callback) {
    if (data) {
        fetch('/api/inSession/end', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(() => {
            if (callback) callback()
        })
            .catch((err) => {
                console.log(err)
            })
        } else {
        fetch('/api/inSession/end', {
            method: 'POST'
        })
            .catch((err) => {
                console.log(err)
            })

    }
}