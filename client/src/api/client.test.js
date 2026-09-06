import apiClient, {
  getMentors,
  searchMentorsBySemanticQuery,
  verifyMentorSearchEmbedding,
} from "./client";

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

describe("searchMentorsBySemanticQuery", () => {
  afterEach(() => jest.restoreAllMocks());

  it("posts only the raw query text to semantic mentor search", async () => {
    const post = jest.spyOn(apiClient, "post").mockResolvedValue({
      data: { mentors: [] },
    });

    await searchMentorsBySemanticQuery("Help with backend interviews");

    expect(post).toHaveBeenCalledWith("/mentor-search", {
      query: "Help with backend interviews",
    });
  });
});
