import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type SchoolConfirmationEmailProps = {
  schoolName: string;
  schoolCode: string;
  confirmationUrl: string;
};

export default function SchoolConfirmationEmail({
  schoolName,
  schoolCode,
  confirmationUrl,
}: SchoolConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Confirm your school email for {schoolName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Confirm Your School Email</Heading>
          <Text style={paragraph}>
            {schoolName} has been created in Stackable and is currently pending email
            confirmation.
          </Text>
          <Text style={paragraph}>
            School code: <strong>{schoolCode}</strong>
          </Text>
          <Section style={buttonWrap}>
            <Button href={confirmationUrl} style={button}>
              Confirm school email
            </Button>
          </Section>
          <Text style={paragraph}>
            Once this link is confirmed, the school can move from pending status to
            active.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you did not expect this email, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f6f6f6",
  fontFamily: "Arial, sans-serif",
  padding: "32px 0",
};

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "20px",
  padding: "32px",
  margin: "0 auto",
  maxWidth: "560px",
};

const heading = {
  color: "#111827",
  fontSize: "28px",
  lineHeight: "1.2",
  margin: "0 0 20px",
};

const paragraph = {
  color: "#4b5563",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0 0 14px",
};

const buttonWrap = {
  margin: "26px 0",
};

const button = {
  backgroundColor: "#F19F24",
  borderRadius: "14px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: "700",
  padding: "14px 24px",
  textDecoration: "none",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const footer = {
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0",
};
