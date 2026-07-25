import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportForm } from "@/app/components/ReportForm";

describe("ReportForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a complete English report with a street address", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, reference: "LP-789" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    render(<ReportForm />);

    await user.type(screen.getByLabelText(/street address/i), "Valtakatu 1");
    await user.click(screen.getByLabelText(/vapor from ground/i));
    await user.click(screen.getByLabelText(/water pond/i));
    await user.click(screen.getByLabelText(/clear deviation/i));
    await user.click(screen.getByLabelText(/i understand/i));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => expect(screen.getByText("LP-789")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/reports", expect.objectContaining({ method: "POST" }));
  });

  it("switches to Finnish labels and validates consent", async () => {
    const user = userEvent.setup();
    render(<ReportForm />);

    expect(screen.getByRole("button", { name: "Suomi" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Suomi" }));
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /vuotoraportti/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ilmoitus/i }));
    expect(await screen.findByText(/suostumus vaaditaan/i)).toBeInTheDocument();
    expect(screen.getAllByText(/karttapiste/i).length).toBeGreaterThan(0);
  });

  it("supports photo upload and retry after failed submission", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, message: "City report endpoint rejected the report." }), {
          status: 502,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, reference: "LP-900" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );

    render(<ReportForm />);
    await user.type(screen.getByLabelText(/street address/i), "Snellmaninkatu 2");
    await user.click(screen.getByLabelText(/melted snow/i));
    await user.click(screen.getByLabelText(/slight suspicion/i));
    await user.upload(screen.getByLabelText(/photo/i), new File(["img"], "snow.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByLabelText(/i understand/i));
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    expect(await screen.findByText(/submission failed/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getByText("LP-900")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});


