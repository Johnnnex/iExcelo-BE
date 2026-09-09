import { loadTemplate } from './load-template.util.js';

interface MessageItem {
  senderName: string;
  preview: string;
  chatroomId: string;
}

function buildMessageRow(m: MessageItem, frontendUrl: string): string {
  const initial = m.senderName.charAt(0).toUpperCase();
  const replyUrl = `${frontendUrl}/messages/${m.chatroomId}`;
  return `<tr>
  <td class="divider" style="padding:16px 0;border-bottom:1px solid #F2F4F7;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;">
      <tr>
        <td width="36" valign="middle">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td class="avatar-bg" width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;background-color:#EFF8FF;border-radius:50%;font-size:15px;font-weight:700;color:#007FFF;line-height:36px;text-align:center;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">${initial}</td>
            </tr>
          </table>
        </td>
        <td style="padding-left:10px;" valign="middle">
          <p class="body-strong" style="margin:0;font-size:14px;font-weight:700;color:#1a1a1a;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">${m.senderName}</p>
        </td>
      </tr>
    </table>
    <p class="body-sub" style="margin:0 0 10px;font-size:14px;color:#444444;line-height:1.6;padding-left:46px;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">&ldquo;${m.preview}&rdquo;</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-left:46px;">
      <tr>
        <td class="reply-pill" style="background-color:#EFF8FF;border-radius:6px;padding:7px 16px;">
          <a class="reply-link" href="${replyUrl}" style="font-size:13px;font-weight:600;color:#007FFF;text-decoration:none;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">Reply &rarr;</a>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

export function getNewMessagesEmailTemplate(params: {
  firstName: string;
  messages: MessageItem[];
  frontendUrl: string;
}): { subject: string; html: string } {
  const { firstName, messages, frontendUrl } = params;
  const messagesUrl = `${frontendUrl}/messages`;

  const subject =
    messages.length === 1
      ? `New message from ${messages[0].senderName}`
      : `${messages.length} new messages waiting for you`;

  if (messages.length === 1) {
    const m = messages[0];
    return {
      subject,
      html: loadTemplate('05a-new-message-single.html', {
        name: firstName,
        senderName: m.senderName,
        senderInitial: m.senderName.charAt(0).toUpperCase(),
        messagePreview: m.preview,
        replyUrl: `${frontendUrl}/messages/${m.chatroomId}`,
        messagesUrl,
      }),
    };
  }

  return {
    subject,
    html: loadTemplate('05b-new-messages-batch.html', {
      name: firstName,
      messageCount: messages.length.toString(),
      messageRows: messages.map((m) => buildMessageRow(m, frontendUrl)).join('\n'),
      messagesUrl,
    }),
  };
}
