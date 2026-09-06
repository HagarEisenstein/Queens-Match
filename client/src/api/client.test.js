import apiClient, { getMentors, verifyMentorSearchEmbedding } from "./client";

describe("getMentors", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the legacy mentors URL when no topics are selected", async () => {
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({ data: [] });

    await getMentors([]);

    expect(get).toHaveBeenCalledWith("/mentors");
  });

  it("appends selected topics as repeated encoded query parameters", async () => {
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({ data: [] });

    await getMentors(["CV / Resume Review", "System Design Interviews"]);

    expect(get).toHaveBeenCalledWith(
      "/mentors?adviceTopics=CV+%2F+Resume+Review&adviceTopics=System+Design+Interviews"
    );
  });
});

describe("verifyMentorSearchEmbedding", () => {
  afterEach(() => jest.restoreAllMocks());

  it("posts only the mentor search query", async () => {
    const post = jest.spyOn(apiClient, "post").mockResolvedValue({
      data: { ok: true, dimension: 3072 },
    });

    await verifyMentorSearchEmbedding("Help with backend interviews");

    expect(post).toHaveBeenCalledWith("/mentor-search/embedding", {
      query: "Help with backend interviews",
    });
  });
});
