// Reuse the client's env so the in-process Stagenet has DB/RPC URLs.
require('dotenv').config({
    path: require('path').resolve(__dirname, '../../client/.env'),
});

if (!process.env.FORK_CHAIN_ID) {
    process.env.FORK_CHAIN_ID = '1';
}
