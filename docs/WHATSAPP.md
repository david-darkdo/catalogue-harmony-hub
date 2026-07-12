# WhatsApp Commerce Workflow

## Customer Flow
1.  Customer adds products to their lookbook.
2.  Clicks "Submit Inquiry via WhatsApp".
3.  The system opens WhatsApp, pre-populating the chat with a formatted message:
    *   Customer name and contact.
    *   Inquiry reference code.
    *   List of product codes and quantities.
    *   Direct link to the lookbook.

## Admin CRM Integration
*   The message submission writes a lead record to the `whatsapp_inquiries` table.
*   Admins monitor active inquiries in the Admin OS dashboard to track sales statuses.

## Future WhatsApp Business API
*   Transitioning from click-to-chat links to automated, interactive chat sessions.
