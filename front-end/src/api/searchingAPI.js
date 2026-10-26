
module.exports.stop = function() {
    fetch('/api/searching/remove', {
        method: 'GET'
    })
        .catch((err) => {
            console.log(err)
        })
}