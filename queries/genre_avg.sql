select genre, avg(rating) as average_rating 
from movies 
group by genre 
order by average_rating desc;