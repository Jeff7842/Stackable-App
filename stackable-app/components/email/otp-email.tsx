import * as React from "react";

type OtpEmailProps = {
  otpCode: string;
  firstName: string;
};


export default function OtpEmail({ firstName,otpCode }: OtpEmailProps) {

  const formattedOtp = String(otpCode).replace(/(\d{3})(?=\d)/g, "$1 ");
  return (
    
    <div
      style={{
        margin: 0,
        padding: "24px 12px",
        backgroundColor: "#f5f7fb",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#111827",
      }}
    >
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        width="100%"
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "20px",
        }}
      >
        <tbody>
          <tr>
            <td align="center" style={{ padding: "42px 32px 30px" }}>
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                border={0}
                style={{ margin: "0 auto 35px" }}
              >
                <tbody>
                  <tr>
                    <td valign="middle">
                      <img
                        src="https://fra.cloud.appwrite.io/v1/storage/buckets/69ac40470009f698eaa6/files/69ac5a0b001a17095b3f/view?project=69ac40280023906386c4&mode=admin"
                        width="65"
                        height="100%"
                        alt="Stackable"
                        style={{ display: "block", border: 0 }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{
                  fontSize: "30px",
                  lineHeight: "36px",
                  fontWeight: 700,
                  color: "#111827",
                  margin: "0 0 12px",
                }}
              >
                Let&apos;s log you in
              </div>

              <div
                style={{
                  maxWidth: "500px",
                  margin: "0 auto 26px",
                  fontSize: "16px",
                  lineHeight: "24px",
                  color: "#4b5563",
                }}
              >
                Hi {firstName},kindly use the verification code below to complete your sign-up
                securely.This code will expire in 10 minutes.
              </div>

              <div
                style={{
                  fontSize: "12px",
                  lineHeight: "18px",
                  fontWeight: 500,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "#ECB938",
                  margin: "0 0 10px",
                }}
              >
                Verification Code
              </div>

              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                border={0}
                width="100%"
                style={{
                  maxWidth: "400px",
                  margin: "0 auto 22px",
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "14px",
                }}
              >
                <tbody>
                  <tr>
                    <td align="center" style={{ padding: "22px 18px" }}>
                      <div
                        style={{
                          fontSize: "38px",
                          lineHeight: "38px",
                          fontWeight: 700,
                          letterSpacing: "9px",
                          color: "#111827",
                        }}
                      >
                        {otpCode}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{
                  maxWidth: "500px",
                  margin: "0 auto 30px",
                  fontSize: "15px",
                  lineHeight: "22px",
                  color: "#6b7280",
                }}
              >
                If you didn&apos;t request this email, you can safely ignore it
              </div>

              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                border={0}
                width="100%"
                style={{ margin: "0 auto 22px" }}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        borderTop: "1px solid #e5e7eb",
                        fontSize: 0,
                        lineHeight: 0,
                      }}
                    >
                      &nbsp;
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{
                  fontSize: "13px",
                  lineHeight: "20px",
                  color: "#9ca3af",
                  margin: "0 0 16px",
                }}
              >
                Built for secure and seamless identity verification.
              </div>

              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                border={0}
                style={{ margin: "0 auto 16px" }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: "0 7px" }}>
                      <a
                        href="https://discord.com"
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <img
                          src="https://cdn.simpleicons.org/discord/9ca3af"
                          width="18"
                          height="18"
                          alt="Discord"
                          style={{ display: "block", border: 0 }}
                        />
                      </a>
                    </td>
                    <td style={{ padding: "0 7px" }}>
                      <a
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <img
                          src="https://cdn.simpleicons.org/github/9ca3af"
                          width="18"
                          height="18"
                          alt="GitHub"
                          style={{ display: "block", border: 0 }}
                        />
                      </a>
                    </td>
                    <td style={{ padding: "0 7px" }}>
                      <a
                        href="https://twitter.com"
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <img
                          src="https://cdn.simpleicons.org/x/9ca3af"
                          width="18"
                          height="18"
                          alt="X"
                          style={{ display: "block", border: 0 }}
                        />
                      </a>
                    </td>
                    <td style={{ padding: "0 7px" }}>
                      <a
                        href="mailto:support@yourdomain.com"
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <img
                          src="https://cdn.simpleicons.org/gmail/9ca3af"
                          width="18"
                          height="18"
                          alt="Email"
                          style={{ display: "block", border: 0 }}
                        />
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{
                  fontSize: "12px",
                  lineHeight: "18px",
                  color: "#9ca3af",
                }}
              >
                © 2026 Stackable. All rights reserved.
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}