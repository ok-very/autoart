/**
 * RegisterPage
 *
 * Wrapper around LoginPage with register mode.
 */

import { LoginPage } from './LoginPage';

export function RegisterPage() {
    return <LoginPage initialMode="register" />;
}
