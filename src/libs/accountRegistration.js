// Shared parser for the draft/account-registration capability value
// (comma-separated tokens such as before-connect,email-required,
// custom-account-name,min-password-length=<num>). Used by the network
// state helper, the login-page probe gating, and the registration forms
// so they all agree on what the server advertised.
export function parseAccountRegistrationCap(value) {
    const info = {
        beforeConnect: false,
        customAccountName: false,
        emailRequired: false,
        minPasswordLength: 0,
        maxPasswordLength: 0,
    };
    if (!value) {
        return info;
    }
    value.split(',').forEach((token) => {
        const [key, val] = token.split('=');
        if (key === 'before-connect') {
            info.beforeConnect = true;
        } else if (key === 'custom-account-name') {
            info.customAccountName = true;
        } else if (key === 'email-required') {
            info.emailRequired = true;
        } else if (key === 'min-password-length') {
            info.minPasswordLength = parseInt(val, 10) || 0;
        } else if (key === 'max-password-length') {
            info.maxPasswordLength = parseInt(val, 10) || 0;
        }
    });
    return info;
}
