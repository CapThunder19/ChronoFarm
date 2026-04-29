import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sinceParam = searchParams.get("since");
  const since = sinceParam ? Number(sinceParam) : Date.now() - 60_000;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let cursorDate = Number.isFinite(since) ? new Date(since) : new Date(Date.now() - 60_000);
      let intervalId: ReturnType<typeof setInterval> | null = null;
      let stopped = false;

      const sendChunk = (payload: unknown) => {
        controller.enqueue(encoder.encode(`event: messages\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      const sendHeartbeat = () => {
        controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
      };

      const tick = async () => {
        if (stopped) {
          return;
        }

        try {
          const newMessages = await prisma.chatMessage.findMany({
            where: {
              createdAt: {
                gt: cursorDate,
              },
            },
            orderBy: {
              createdAt: "asc",
            },
            take: 100,
          });

          if (newMessages.length > 0) {
            cursorDate = newMessages[newMessages.length - 1].createdAt;
            sendChunk({ messages: newMessages });
          } else {
            sendHeartbeat();
          }
        } catch (error) {
          console.error(error);
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "stream_failed" })}\n\n`),
          );
        }
      };

      void (async () => {
        const latest = await prisma.chatMessage.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
        });

        if (latest.length > 0) {
          cursorDate = latest[0].createdAt;
        }

        sendChunk({ messages: latest.reverse() });
        intervalId = setInterval(() => {
          void tick();
        }, 1500);
      })();

      req.signal.addEventListener("abort", () => {
        stopped = true;
        if (intervalId) {
          clearInterval(intervalId);
        }
        controller.close();
      });
    },
    cancel() {
      // Closed by the client.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
