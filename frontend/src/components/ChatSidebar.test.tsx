import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";
import { initialData } from "@/lib/kanban";

const chatResponse = (reply: string, boardUpdated = false) => ({
  ok: true,
  json: async () => ({ reply, board_updated: boardUpdated, board: initialData }),
});

const send = async (text: string) => {
  await userEvent.type(screen.getByLabelText("Message"), text);
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
};

// The sidebar starts closed; open it before chatting
const renderOpen = async (onBoardUpdate = vi.fn()) => {
  render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);
  await userEvent.click(screen.getByRole("button", { name: /ask ai/i }));
};

const sentBody = (fetchMock: ReturnType<typeof vi.fn>, call: number) =>
  JSON.parse(fetchMock.mock.calls[call][1].body);

describe("ChatSidebar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a message and shows the reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse("You have 8 cards."));
    vi.stubGlobal("fetch", fetchMock);
    await renderOpen();

    await send("How many cards?");

    expect(await screen.findByText("You have 8 cards.")).toBeInTheDocument();
    expect(screen.getByTestId("chat-user")).toHaveTextContent("How many cards?");
    expect(fetchMock).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST" }));
    expect(sentBody(fetchMock, 0)).toEqual({ message: "How many cards?", history: [] });
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("sends the conversation history with later messages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatResponse("First reply"))
      .mockResolvedValueOnce(chatResponse("Second reply"));
    vi.stubGlobal("fetch", fetchMock);
    await renderOpen();

    await send("First");
    await screen.findByText("First reply");
    await send("Second");
    await screen.findByText("Second reply");

    expect(sentBody(fetchMock, 1)).toEqual({
      message: "Second",
      history: [
        { role: "user", content: "First" },
        { role: "assistant", content: "First reply" },
      ],
    });
  });

  it("updates the board only when the AI changed it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatResponse("Just a question.", false))
      .mockResolvedValueOnce(chatResponse("Moved it.", true));
    vi.stubGlobal("fetch", fetchMock);
    const onBoardUpdate = vi.fn();
    await renderOpen(onBoardUpdate);

    await send("What is in Done?");
    await screen.findByText("Just a question.");
    expect(onBoardUpdate).not.toHaveBeenCalled();

    await send("Move a card");
    await screen.findByText("Moved it.");
    expect(onBoardUpdate).toHaveBeenCalledWith(initialData);
  });

  it("shows a thinking indicator while waiting", async () => {
    let resolve: (value: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise((r) => (resolve = r))));
    await renderOpen();

    await send("Hello");
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();

    resolve(chatResponse("Hi!"));
    expect(await screen.findByText("Hi!")).toBeInTheDocument();
    expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
  });

  it("shows an error when the AI is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    const onBoardUpdate = vi.fn();
    await renderOpen(onBoardUpdate);

    await send("Hello");

    expect(await screen.findByRole("alert")).toHaveTextContent(/ai is unavailable/i);
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("does not send an empty message", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await renderOpen();

    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Message"), "   {enter}");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts closed, opens, and closes", async () => {
    render(<ChatSidebar onBoardUpdate={vi.fn()} />);
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /ask ai/i }));
    expect(screen.getByLabelText("Message")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /close assistant/i }));
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });
});
