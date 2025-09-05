select genre, round(avg(rating), 2) as avg_rating
from movies
group by genre
order by avg_rating desc;