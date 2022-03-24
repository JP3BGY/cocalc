import { Icon } from "@cocalc/frontend/components/icon";
import { Strategy } from "@cocalc/util/types/sso";
import { Alert, Button, Input } from "antd";
import Contact from "components/landing/contact";
import SquareLogo from "components/logo-square";
import A from "components/misc/A";
import apiPost from "lib/api/post";
import useCustomize from "lib/use-customize";
import { useMemo, useState } from "react";
import { LOGIN_STYLE } from "./shared";
import SSO, { RequiredSSO } from "./sso";

interface Props {
  strategies?: Strategy[];
  minimal?: boolean;
  onSuccess?: () => void; // if given, call after sign in *succeeds*.
}

export default function SignIn({ strategies, minimal, onSuccess }: Props) {
  const { anonymousSignup, siteName } = useCustomize();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const haveSSO = strategies != null && strategies.length > 0;

  // based on email: if user has to sign up via SSO, this will tell which strategy to use.
  const requiredSSO: Strategy | undefined = useMemo(() => {
    // if the domain of email is contained in any of the strategie's exclusiveDomain array, return that strategy's name
    if (!haveSSO) return;
    const domain = email.trim().toLowerCase().split("@")[1];
    for (const strategy of strategies) {
      if (strategy.exclusiveDomains.includes(domain)) {
        return strategy;
      }
    }
  }, [email]);

  async function signIn() {
    if (signingIn) return;
    setError("");
    try {
      setSigningIn(true);
      await apiPost("/auth/sign-in", { email, password });
      onSuccess?.();
    } catch (err) {
      setError(`${err}`);
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div style={{ margin: "30px", minHeight: "50vh" }}>
      {!minimal && (
        <div style={{ textAlign: "center", marginBottom: "15px" }}>
          <SquareLogo
            style={{ width: "100px", height: "100px", marginBottom: "15px" }}
            priority={true}
          />
          <h1>Sign In to {siteName}</h1>
        </div>
      )}

      <div style={LOGIN_STYLE}>
        <div style={{ margin: "10px 0" }}>
          {strategies == null
            ? "Sign in"
            : haveSSO
            ? "Sign in using your email address or a single sign on provider."
            : "Sign in using your email address."}
        </div>
        <form>
          {haveSSO && (
            <div style={{ textAlign: "center", margin: "20px 0" }}>
              <SSO
                strategies={strategies}
                size={email ? 24 : undefined}
                style={
                  email
                    ? { textAlign: "right", marginBottom: "20px" }
                    : undefined
                }
              />
            </div>
          )}
          <Input
            autoFocus
            style={{ fontSize: "12pt" }}
            placeholder="Email address"
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
          />

          <RequiredSSO strategy={requiredSSO} />
          {/* Don't remove password input, since that messes up autofill. Hide for forced SSO. */}
          <div
            style={{
              marginTop: "30px",
              visibility: requiredSSO == null ? "visible" : "hidden",
            }}
          >
            <p>Password </p>
            <Input.Password
              style={{ fontSize: "12pt" }}
              autoComplete="current-password"
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
              onPressEnter={(e) => {
                e.preventDefault();
                signIn();
              }}
            />
          </div>
          {email && requiredSSO == null && (
            <Button
              disabled={signingIn || !(password?.length >= 6)}
              shape="round"
              size="large"
              type="primary"
              style={{ width: "100%", marginTop: "20px" }}
              onClick={signIn}
            >
              {signingIn ? (
                <>
                  <Icon name="spinner" spin /> Signing In...
                </>
              ) : !password || password.length < 6 ? (
                "Enter your password above."
              ) : (
                "Sign In"
              )}
            </Button>
          )}
        </form>
        {error && (
          <>
            <Alert
              style={{ marginTop: "20px" }}
              message="Error"
              description={
                <>
                  <p>
                    <b>{error}</b>
                  </p>
                  <p>
                    If you can't remember your password,{" "}
                    <A href="/auth/password-reset">reset it</A>. If that doesn't
                    work <Contact />.
                  </p>
                </>
              }
              type="error"
              showIcon
            />
            <div
              style={{
                textAlign: "center",
                marginTop: "15px",
                fontSize: "14pt",
              }}
            >
              <A href="/auth/password-reset">Forgot password?</A>
            </div>
          </>
        )}
      </div>

      {!minimal && (
        <div
          style={{
            ...LOGIN_STYLE,
            backgroundColor: "white",
            margin: "30px auto",
            padding: "15px",
          }}
        >
          New to {siteName}? <A href="/auth/sign-up">Sign Up</A>
          {anonymousSignup && (
            <div style={{ marginTop: "15px" }}>
              Don't want to provide any information?
              <br />
              <A href="/auth/try">
                Try {siteName} without creating an account.
              </A>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
